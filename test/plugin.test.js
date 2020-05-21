import { dirname, relative, resolve } from 'path'
import { test } from 'zora'
import relativeToImport from '../src/plugin'

test('option handling', async assert => {
// These are the only tests that touch the file system
  const optionTestCases = [
    {
      description: 'look up rootDir by finding nearest package.json', // Which is root of this plugin package
      input: { rootDir: undefined },
      expected: { rootDir: process.cwd() }
    },
    {
      description: 'look up module in package.json, and select first available field',
      input: { module: undefined, rootDir: process.cwd() },
      expected: { module: 'src/plugin.js', rootDir: process.cwd() } // copied from package.json
    },
    {
      description: 'use module as modulePaths',
      input: { modulePaths: undefined },
      expected: { modulePaths: 'index.js' } // from defaultOptions
    },
    {
      description: 'lookup packageName from package.json',
      input: { packageName: undefined, rootDir: process.cwd() },
      expected: { packageName: 'rollup-plugin-relative-to-import', rootDir: process.cwd() }
    }
  ]

  // Specify every possible option to ensure there are no unintended changes
  const defaultOptions = {
    extensions: ['*.js', '*.mjs'],
    mainFields: ['module'],
    rootDir: '/home/awesome/package',
    module: 'index.js',
    modulePaths: ['src/**/*.js'],
    packageName: 'double-super-awesome'
  }

  for (const testCase of optionTestCases) {
    const input = { ...defaultOptions, ...testCase.input }
    const expected = { ...defaultOptions, ...testCase.expected }

    const plugin = relativeToImport(input)
    // Rollup expects buildStart to return null.
    // Taking advantage of that to access the initialized options for testing
    const actual = await plugin.buildStart({})
    assert.deepEqual(actual, expected, testCase.description)
  }
})

/*
  Specify different package structures, and what the imports would look like in each.
  Treat each module structure as a separate test.
  Then for each module structure, run through the import possibilities
*/
const moduleStructure = [
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

moduleStructure
  .forEach(structure => {
    const { options, imports, entryPoint } = structure
    const pluginOptions = {
      rootDir: '/home/awesome/package',
      packageName: 'double-super-awesome',
      ...options
    }
    const importer = `${pluginOptions.rootDir}/${entryPoint}` // Not used in one test case
    const testCases = [
      {
        description: 'handles external packages',
        id: 'zora',
        importer,
        expected: { id: 'zora', external: true }
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
        expected: { id: pluginOptions.packageName, external: true }
      },
      {
        description: 'module import with extension',
        id: `${imports.module}.js`,
        importer,
        expected: { id: pluginOptions.packageName, external: true }
      },
      {
        description: 'test helper file import',
        id: imports.helper,
        importer,
        expected: null
      }

    ]

    if (imports.direct) {
      const idPath = resolve(dirname(importer), imports.direct) // this is absolute path of id
      const relativeIdPath = relative(pluginOptions.rootDir, idPath) // this is relative to packageDir
      const testCase = {
        description: 'direct import of file within module',
        id: imports.direct,
        importer,
        expected: { id: `${pluginOptions.packageName}/${relativeIdPath}`, external: true }
      }
      testCases.push(testCase)
    }

    test(structure.description, async assert => {
      for (const testCase of testCases) {
        const { description, id, importer, expected } = testCase
        const options = { ...pluginOptions }
        const plugin = relativeToImport(options)
        await plugin.buildStart(/* plugin does not use inputOptions */)
        const actual = await plugin.resolveId(id, importer)
        assert.deepEqual(actual, expected, description)
      }
    })
  })
