import relativeToImport from '../src/plugin'
import { test } from 'zora'
import pkgDir from 'pkg-dir'

const defaults = {
  module: 'src/plugin.js',
  rootDir: '/home/superuser/awesome/',
  importer: '/home/superuser/awesome/test/plugin.test.js',
  packageName: '@superuser/awesome'
}

test('rollup-plugin-relative-to-import', async assert => {
  const rootDir = await pkgDir()

  const testCases = [
    {
      ...defaults,
      description: 'handles external packages',
      id: 'zora',
      expected: { id: 'zora', external: true }
    },
    {
      ...defaults,
      description: 'entry point is handled by rollup by returning null',
      id: 'test/plugin.test.js',
      importer: undefined,
      expected: null
    },
    {
      ...defaults,
      description: 'module import without extension',
      id: '../src/plugin',
      expected: { id: defaults.packageName, external: true }
    },
    {
      ...defaults,
      description: 'module import with extension',
      id: '../src/plugin.js',
      expected: { id: defaults.packageName, external: true }
    },
    {
      description: 'looks up packageDir from package when not provided',
      id: '../src/plugin',
      module: 'src/plugin.js',
      // Leaving out rootDir as part of test
      importer: `${rootDir}/test/plugin.test.js`,
      packageName: '@superuser/awesome',
      expected: { id: '@superuser/awesome', external: true }
    },
    {
      description: 'looks up module from package.json when not provided',
      id: '../src/plugin',
      // Leaving out module, which happens to be 'src/plugin.js' anyway
      rootDir, // must be rootDir because it is used to find package.json
      importer: `${rootDir}/test/plugin.test.js`,
      packageName: '@superuser/awesome',
      expected: { id: '@superuser/awesome', external: true }
    },
    {
      description: 'looks up packageName from package.json when not provided',
      id: '../src/plugin',
      module: 'src/plugin.js',
      rootDir, // must be rootDir because it is used to find package.json
      importer: `${rootDir}/test/plugin.test.js`,
      // Leaving out packageName
      expected: { id: 'rollup-plugin-relative-to-import', external: true }
    },
    {
      ...defaults,
      description: 'non-module relative imports that are in same directory left to Rollup to handle',
      id: './relative-helper',
      expected: null
    },
    // This test highlights the assumption that all module code is in the module's directory (or a subdirectory)
    {
      ...defaults,
      description: 'relative imports not in module are left to Rollup to handle',
      id: '../not-in-module-directory/import',
      expected: null
    }
    // TODO ../notinmodule/import.js
    // TODO Relative import, not in module
    // TODO files all sitting together
  ]

  for (const testCase of testCases) {
    const { description, id, module, rootDir, packageName, importer, expected } = testCase
    const plugin = relativeToImport({ module, rootDir, packageName })
    await plugin.buildStart({})
    const actual = await plugin.resolveId(id, importer)
    assert.deepEqual(actual, expected, description)
  }
})
