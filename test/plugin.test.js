import { format } from 'date-fns'
import fs from 'fs-extra'
import { tmpdir } from 'os'
import { dirname, join, relative, resolve } from 'path'
import { test } from 'zora'
import relativeToImport from 'rollup-plugin-relative-to-package'
import testPackageJson from './make-package-json.js'

// Build a fake package in a temporary directory. The only file required is package.json
const setupFakePackage = async () => {
  const timePart = format(Date.now(), 'yyyy-MM-dd-kk-mm-ss')
  const tempPath = join(tmpdir(), `relative-to-import-${timePart}`)
  await fs.ensureDir(tempPath)
  await fs.writeJSON(join(tempPath, 'package.json'), testPackageJson, { spaces: 2 })
  return tempPath
}

test('option handling', async assert => {
  // Setup fake package for the two tests that read from package.json
  const tempPath = await setupFakePackage()

  const optionTestCases = [
    {
      description: 'look up rootDir by finding nearest package.json',
      options: { rootDir: undefined },
      expected: { rootDir: process.cwd() }
    },
    {
      description: 'use module as modulePaths',
      options: { modulePaths: undefined, module: 'source/fancy-module.js' },
      expected: { modulePaths: 'source/fancy-module.js', module: 'source/fancy-module.js' }
    },
    { // Reads from package.json
      description: 'look up module in package.json, and select first available field',
      options: { module: undefined, rootDir: tempPath },
      expected: { module: testPackageJson.module, rootDir: tempPath }
    },
    { // Reads from package.json
      description: 'lookup packageName from package.json',
      options: { packageName: undefined, rootDir: tempPath },
      expected: { packageName: testPackageJson.name, rootDir: tempPath }
    }
  ]

  for (const testCase of optionTestCases) {
    // Override default of every possible option to ensure there are no unintended changes
    const defaultOptions = {
      extensions: ['*.js', '*.mjs'],
      mainFields: ['module'],
      rootDir: '/home/awesome/package',
      module: 'index.js',
      modulePaths: ['src/**/*.js'],
      packageName: 'double-super-awesome'
    }

    const options = { ...defaultOptions, ...testCase.options }
    const expected = { ...defaultOptions, ...testCase.expected }

    const plugin = relativeToImport(options)
    // Rollup ignores return value of buildStart
    // Taking advantage of that to access the initialized options for testing
    const actual = await plugin.buildStart({})
    assert.deepEqual(actual, expected, testCase.description)
  }
})

/*
  Overall testing strategy:

  Id resolution for this plugin happens in the context of a specific directory structure. Therefore,
  each id resolution test case must be tested with each possible kind of directory structure.

  To do this, directory structure test cases are specified separately from id resolution test cases.
  Then all the possible combinations of those test cases are generated and run.

  Each test case only specifies what it cares about, and the plugin uses default values for the rest
  of the input parameters.

  The id resolution test cases are defined by idResolutionTestCases.

*/
const directoryStructureTestCases = [
  {
    description: 'module is a single file',
    entryPoint: 'test/index.test.js', // test module location relative to package root
    options: { // Options required to tell the plugin about the test structure
      module: 'src/index.js'
    },
    imports: { // Imports as they would look in the entryPoint
      module: '../src/index', // relative import path to module from test
      helper: './helper' // relative import path to helper from test
    }
  },
  {
    description: 'module is multiple files in package root',
    entryPoint: 'index.test.js',
    options: {
      module: 'index.js',
      modulePaths: ['index.js', 'module-import.js'], // needed for imports.direct
      packageName: '@myscope/super-awesome' // Just to test scoped package names
    },
    imports: {
      module: './index',
      direct: './module-import', // importing a file that is part of the module directly
      helper: './helper'
    }
  },
  {
    description: 'module is multiple files in a single directory',
    entryPoint: 'test/index.test.js',
    options: {
      module: 'src/index.js',
      modulePaths: ['src/**/*.js']
    },
    imports: {
      module: '../src/index',
      direct: '../src/part-of-package',
      helper: './helper'
    }
  },
  {
    description: 'module is split across multiple directories',
    entryPoint: 'test/index.test.js',
    options: {
      module: 'src/index.js',
      modulePaths: ['src/**/*.js', 'assets/**/*.json']
    },
    imports: {
      module: '../src/index',
      direct: '../assets/special/data.json',
      helper: '../helpers/helper.js'
    }
  },
  {
    description: 'module is in package root, but imports from a directory',
    entryPoint: 'index.test.js',
    options: {
      module: 'index.js',
      modulePaths: ['src/**/*.js'] // Test that module does not have to be in modulePaths
    },
    imports: {
      module: './index',
      direct: './src/module-file',
      helper: './helpers/helper.js'
    }
  },
  {
    // This is the most convenient place to test this, even though these tests are about directory structure
    description: 'test that modulePaths can be a glob string instead of Array',
    entryPoint: 'index.test.js',
    options: {
      module: 'index.js',
      modulePaths: 'src/**/*.js' // <-- testing this
    },
    imports: {
      module: './index',
      direct: './src/module-file',
      helper: './helpers/helper.js'
    }
  }
]

directoryStructureTestCases
  .forEach(structure => {
    const { options, imports, entryPoint } = structure

    // This is the options Object that will be used to initialize the plugin.
    // Id resolution test cases are defined in terms of this Object.
    const structureOptions = {
      rootDir: '/home/awesome/package',
      packageName: 'double-super-awesome',
      ...options // may override default values
    }

    // Importer parameter to plugin.resolveId can be null for a test case, so each test case
    // has to choose the value it wants. // This is the value used in the common case
    const importer = `${structureOptions.rootDir}/${entryPoint}`

    // Define the id resolution test cases in terms of structureOptions
    const idResolutionTestCases = [
      {
        description: 'handles external packages',
        id: 'zora', // id provided to plugin.resolveId
        importer, // importer provided to plugin.resolveId
        expected: { id: 'zora', external: true } // expected output from plugin
      },
      {
        description: 'id is entry point',
        id: entryPoint,
        importer: undefined,
        expected: null
      },
      {
        description: 'module import without extension',
        id: imports.module,
        importer,
        expected: { id: structureOptions.packageName, external: true }
      },
      {
        description: 'module import with extension',
        id: `${imports.module}.js`,
        importer,
        expected: { id: structureOptions.packageName, external: true }
      },
      {
        description: 'helper file import',
        id: imports.helper,
        importer,
        expected: null
      }

    ]

    if (imports.direct) {
      const idPath = resolve(dirname(importer), imports.direct) // this is absolute path of id
      const relativeIdPath = relative(structureOptions.rootDir, idPath) // this is relative to packageDir
      const testCase = {
        description: 'direct import of file within module',
        id: imports.direct,
        importer,
        expected: { id: `${structureOptions.packageName}/${relativeIdPath}`, external: true }
      }
      idResolutionTestCases.push(testCase)
    }

    test(structure.description, async assert => {
      for (const testCase of idResolutionTestCases) {
        const { description, id, importer, expected } = testCase
        const plugin = relativeToImport(structureOptions)
        await plugin.buildStart(/* plugin does not use inputOptions */)
        const actual = await plugin.resolveId(id, importer)
        assert.deepEqual(actual, expected, description)
      }
    })
  })
