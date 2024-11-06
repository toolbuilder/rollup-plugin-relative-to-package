import { format } from 'date-fns'
import fs from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
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

test('option handling for options that may require disk access', async assert => {
  // Setup fake package for the two tests that read from package.json
  const tempPath = await setupFakePackage()

  // The test overrides all options for each test case
  // Therefore we only need to check default option values and
  // file system lookups in these test cases.
  //
  // Check the default option value by setting that option to undefined in options field
  // Check the expected default option value by setting that field to expected value in expected
  // Note: this doesn't work for the 'conditions' option because it is never read from the filesystem
  const optionTestCases = [
    {
      description: 'look up rootDir by finding nearest package.json',
      options: { rootDir: undefined },
      expected: { rootDir: process.cwd() }
    },
    { // Reads from package.json
      description: 'lookup packageName from package.json',
      options: { packageName: undefined, rootDir: tempPath },
      expected: { packageName: testPackageJson.name, rootDir: tempPath }
    },
    { // Reads from package.json
      description: 'lookup exports field from package.json',
      options: { exports: undefined, rootDir: tempPath },
      expected: { exports: testPackageJson.exports, rootDir: tempPath }
    }

  ]

  for (const testCase of optionTestCases) {
    // Override default of every possible option to ensure there are no
    // unintended changes caused by evaluating the test case
    const defaultOptions = {
      rootDir: '/home/awesome/package',
      conditions: ['apple', 'orange', 'unused'],
      exports: './index.js',
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

// options.conditions overrides were already tested above
test('options.conditions defaults', async assert => {
  // setup options so plugin does not access filesystem
  // conditions not specified here - default value is what we're testing
  const defaultOptions = {
    rootDir: '/home/awesome/package',
    exports: './index.js',
    packageName: 'double-super-awesome'
  }
  const defaultConditionsSet = ['default', 'import', 'node', 'node-addons']

  const plugin = relativeToImport(defaultOptions)
  // Rollup ignores return value of buildStart
  // Taking advantage of that to access the initialized options for testing
  const { conditions } = await plugin.buildStart({})
  const actual = new Set(conditions) // conditions order does not matter
  const expected = new Set(defaultConditionsSet)
  assert.deepEqual(actual, expected, "default conditions match node defaults for type == 'module'")
})

/*
  Overall testing strategy:

  Id resolution for this plugin happens in the context of a specific directory structure. Therefore,
  each id resolution test case must be tested with each possible kind of directory structure.

  To do this, directory structure test cases are specified separately from id resolution test cases.
  Then all the possible combinations of those test cases are generated and run.

  Each test case only specifies what it cares about, and the test uses default values for the rest
  of the input parameters.

  The id resolution test cases are defined by idResolutionTestCases.

*/
const directoryStructureTestCases = [
  {
    // test description
    description: 'module is a single file',
    // unit test module location relative to package root
    entryPoint: 'test/index.test.js',
    // plugin options parameter. The packageName and rootDir will be added into this by the
    // test so that the test does not access the filesystem.
    options: {
      exports: './src/index.js' // equivalent to { default: { '.': './src/index.js' }}
      // if you provide packageName, it will override the test's choice, which is ok
    },
    // create up to three test cases:
    // * module - the default module entry point
    // * direct - imports something other than the default module entry point
    // * helper - an import that the unit test uses that is not part of the package
    cases: {
      // Array specifies unit test's import specifier, and the matching exports subpath
      // with * replaced approriately if necessary.
      module: ['../src/index.js', '.'], // package entry point and subPath
      helper: ['./helper.js', null] // unit test helper, not exported by package
    }
  },
  {
    description: 'module is multiple files in package root',
    entryPoint: 'index.test.js',
    options: {
      exports: {
        '.': './index.js',
        './extra': './module-import.js'
      },
      packageName: '@myscope/super-awesome' // Just to test scoped package names
    },
    cases: {
      module: ['./index.js', '.'],
      direct: ['./module-import.js', './extra'],
      helper: ['./helper.js', null]
    }
  },
  {
    description: 'module is multiple files in a single subdirectory',
    entryPoint: 'test/index.test.js',
    options: {
      exports: {
        node: {
          '.': './src/index.js',
          './src/*': './src/*.js'
        }
      }
    },
    cases: {
      module: ['../src/index.js', '.'],
      direct: ['../src/part-of-package.js', './src/part-of-package'],
      helper: ['./helper.js', null]
    }
  },
  {
    description: 'conditions in option parameter replace default option set',
    entryPoint: 'test/index.test.js',
    options: {
      // test that conditions specified in options are used
      conditions: ['default', 'browser'], // browser is not part of the default set
      exports: {
        node: { // node is part of default set, but has been replaced
          './wrong': './src/index.js'
        },
        browser: {
          '.': './src/index.js',
          './src/*': './src/*.js'
        }
      }
    },
    cases: {
      module: ['../src/index.js', '.'],
      direct: ['../src/part-of-package.js', './src/part-of-package'],
      helper: ['./helper.js', null]
    }
  },
  {
    description: 'module is split across multiple directories',
    entryPoint: 'test/index.test.js',
    options: {
      exports: {
        import: {
          '.': './src/index.js',
          './special': './assets/special/data.js'
        }
      }
    },
    cases: {
      module: ['../src/index.js', '.'],
      direct: ['../assets/special/data.js', './special'],
      helper: ['../helpers/helper.js', null]
    }
  },
  {
    description: 'module is in package root, but imports from a directory',
    entryPoint: 'index.test.js',
    options: {
      exports: {
        node: {
          '.': './index.js',
          './src/*': './src/*'
        }
      }
    },
    cases: {
      module: ['./index.js', '.'],
      direct: ['./src/module-file.js', './src/module-file.js'],
      helper: ['./helpers/helper.js', null]
    }
  }
]

directoryStructureTestCases
  .forEach(structure => {
    const { options, cases, entryPoint } = structure

    // This is the options Object that will be used to initialize the plugin.
    // Id resolution test cases are defined in terms of this Object.
    const structureOptions = {
      rootDir: '/home/awesome/package',
      packageName: 'double-super-awesome',
      ...options // may override default values
    }

    // Importer parameter to plugin.resolveId can be null for a test case, so each test case
    // has to choose the value it wants.
    // This is the value used in the common case
    const importer = `${structureOptions.rootDir}/${entryPoint}`

    // Define the id resolution test cases in terms of structureOptions
    const idResolutionTestCases = [
      {
        description: 'id is external package',
        id: 'zora', // id provided to plugin.resolveId
        importer, // importer provided to plugin.resolveId
        expected: { id: 'zora', external: true } // expected output from plugin
      },
      {
        description: 'id is the module entry point',
        id: entryPoint,
        importer: undefined,
        expected: null
      }
    ]

    if (cases.module) {
      const [moduleUri, subPath] = cases.module
      const moduleSpecifier = subPath.replace('.', structureOptions.packageName)
      const testCase = {
        description: 'direct import module',
        id: moduleUri,
        importer,
        expected: { id: moduleSpecifier, external: true }
      }
      idResolutionTestCases.push(testCase)
    }

    if (cases.direct) {
      const [moduleUri, subPath] = cases.direct
      const moduleSpecifier = subPath.replace('.', structureOptions.packageName)
      const testCase = {
        description: 'direct import of file within module',
        id: moduleUri,
        importer,
        expected: { id: moduleSpecifier, external: true }
      }
      idResolutionTestCases.push(testCase)
    }

    if (cases.helper) {
      const [moduleUri] = cases.helper
      const testCase = {
        description: 'direct import of unit test helper that is not part of module',
        id: moduleUri,
        importer,
        expected: null
      }
      idResolutionTestCases.push(testCase)
      const testCase2 = {
        description: 'full pathname import of unit test helper that is not part of module',
        id: join(structureOptions.rootDir, moduleUri),
        importer,
        expected: null
      }
      idResolutionTestCases.push(testCase2)
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
