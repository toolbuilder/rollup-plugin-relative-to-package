import { test } from 'zora'
import { isModuleSpecifier } from '../src/module-specifier.js'

test('test specifiers', assert => {
  const relativeSpecifiers = [
    ['./subpath/index.js', false],
    ['../another/subpath/index.js', false]
  ]

  const bareSpecifiers = [
    ['zora', true],
    ['zora/index', true],
    ['my-package/index.js', true]
  ]

  const absoluteSpecifiers = [
    ['/some/path/index.js', false]
    // another plugin is required to convert urls to file paths if required
  ]

  const testCases = []
  testCases.push(...relativeSpecifiers)
  testCases.push(...bareSpecifiers)
  testCases.push(...absoluteSpecifiers)

  testCases.forEach(([id, expected]) => {
    assert.deepEqual(isModuleSpecifier(id), expected, `test ${id}`)
  })
})
