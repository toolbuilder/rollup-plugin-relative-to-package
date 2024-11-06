import { join } from 'path'
import { test } from 'zora'
import { moduleUriResolver } from '../src/module-uri-resolver.js'

test('moduleUri resolution', assert => {
  const rootDir = '/abc/def/packagename'
  const packageName = 'packagename'

  // common test case context
  const context = {
    importer: join(rootDir, 'test/entrypoint.js'),
    rootDir,
    packageName
  }

  const testCases = [
    {
      ...context,
      description: 'import helper from same dir',
      id: './helper.js',
      expected: './test/helper.js'
    },
    {
      ...context,
      description: 'import helper from another dir',
      id: '../helpers/helper.js',
      expected: './helpers/helper.js'
    },
    {
      ...context,
      description: 'entry point in package root as is helper',
      importer: join(rootDir, 'entrypoint.js'),
      id: './helper.js',
      expected: './helper.js'
    },
    {
      ...context,
      description: 'entry point in package root, helper from another dir',
      importer: join(rootDir, 'entrypoint.js'),
      id: './helpers/helper.js',
      expected: './helpers/helper.js'
    },
    {
      ...context,
      description: 'Rollup provides id from same dir as absolute path',
      id: join(rootDir, 'test/helper.js'),
      expected: './test/helper.js'
    },
    {
      ...context,
      description: 'Rollup provides id from another dir as absolute path',
      id: join(rootDir, 'helpers/helper.js'),
      expected: './helpers/helper.js'
    },
    {
      ...context,
      description: 'id is from outside the package',
      id: '/abc/def/anotherpackage/helper.js',
      expected: '../anotherpackage/helper.js'
    }
  ]

  testCases.forEach((testCase, index) => {
    const { description, id, importer, rootDir, expected } = testCase
    const actual = moduleUriResolver(id, importer, rootDir)
    assert.deepEqual(actual, expected, description)
  })
})
