import createTestPackageJson from 'rollup-plugin-create-test-package-json'
import multiInput from 'rollup-plugin-multi-input'
import relativeToPackage from './src/plugin'
import createPackFile from '@toolbuilder/rollup-plugin-create-pack-file'
import runCommands, { shellCommand } from '@toolbuilder/rollup-plugin-commands'
import { tmpdir } from 'os'
import { join } from 'path'

/*
  This Rollup configuration is used by the 'check:packfile' script to validate that the
  packfile can pass the unit tests. It assumes 'pnpm' is installed. You can use 'npm' by
  changing 'pnpm' to 'npm' in this configuration.

  Use this configuration by running 'pnpm run check:packfile'. It will create a temporary
  directory, build a node package in the directory, and run the unit tests on the packfile.
*/

// This is where the test package is created
const testPackageDir = join(tmpdir(), `${Date.now()}`)

export default [
  {
    // process all unit tests, and specify output in 'test' directory of testPackageDir
    input: ['test/**/*test.js'],
    preserveModules: true, // Generate one unit test for each input unit test
    output: {
      format: 'es',
      dir: testPackageDir
    },
    plugins: [
      multiInput(), // Handles the input glob above
      relativeToPackage({ // This package converts relative imports to package imports
        modulePaths: 'src/**/*.js'
      }),
      createTestPackageJson({ // Creates package.json for testPackageDir
        // Provide information that plugin can't pick up for itself
        testPackageJson: {
          scripts: {
            test: 'tape -r esm test/**/*test.js | tap-nirvana'
          },
          // dependencies are populated automatically
          devDependencies: {
            // These are the dependencies for the test runner
            esm: '^3.2.25',
            tape: '^5.0.1',
            'tap-nirvana': '^1.1.0'
          }
        }
      }),
      createPackFile({ // and move it to output.dir (i.e. testPackageDir)
        packCommand: 'pnpm pack'
      }),
      runCommands({
        commands: [
          // Install dependencies and run the unit test
          // The -C parameter ensures that the test does not resolve
          // any packages outside testPackageDir. Ordinarily, it
          // would pickup packages in this package too.
          shellCommand(`pnpm -C ${testPackageDir} install-test`)
        ]
      })
    ]
  }
]
