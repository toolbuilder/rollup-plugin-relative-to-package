import { test } from 'zora'
import { ExportsResolver } from 'rollup-plugin-relative-to-package'

test('null module URI in exports allowed', assert => {
  const packageJson = {
    name: 'nullModule',
    exports: {
      '.': './index.js',
      './null': null
    }
  }

  const resolver = new ExportsResolver(packageJson)
  const moduleUri = resolver.resolveModuleUri('nullModule')
  assert.deepEqual(moduleUri, './index.js', 'handles non-null URI')
  const nullUri = resolver.resolveModuleUri('nullModule/null')
  assert.deepEqual(nullUri, null, 'null URI returns null')
})

test('three exports representations are equivalent', assert => {
  // all these package.json definitions are equivalent
  const testCases = [
    {
      description: 'exports field can be a single string',
      name: '@toolbuilder/apple',
      exports: './index.js'
    },
    {
      description: "default condition is 'default'",
      name: '@toolbuilder/apple',
      exports: { '.': './index.js' }
    },
    {
      description: 'default values can be specified',
      name: '@toolbuilder/apple',
      exports: { default: { '.': './index.js' } }
    }
  ]

  testCases.forEach(pkgJson => {
    const { name } = pkgJson
    const resolver = new ExportsResolver(pkgJson)

    const moduleSpecifier = resolver.resolveModuleSpecifier('./index.js')
    assert.deepEqual(moduleSpecifier, name, pkgJson.description)

    const moduleUri = resolver.resolveModuleUri(name)
    assert.deepEqual(moduleUri, './index.js', pkgJson.description)
  })
})

test('condition matching for module specfifier (i.e. reverse) lookup', assert => {
  const packageJson = {
    name: 'sample',
    // This exports structure is setup to isolate condition
    // checking from target pattern matching. The target
    // pattern is the same for each case, so only the conditions
    // determine which subPath is returned.
    exports: {
      require: {
        './prod': { prod: './cjs/index.js' },
        './dev': { dev: './cjs/index.js' },
        './debug': { debug: './cjs/index.js' }
      },
      './one': { require: './cjs/index.js' }
    }
  }

  const testCases = [
    [
      'no match when no matching conditions are present',
      ['default'],
      undefined
    ],
    [
      'matching falls through two condition case to single condition case',
      ['default', 'require'],
      'sample/one'
    ],
    [
      'all conditions are required to match',
      ['default', 'dev', 'require'],
      'sample/dev'
    ],
    [
      'condition order does not matter',
      ['require', 'default', 'debug'],
      'sample/debug'
    ]
  ]
  testCases.forEach(testCase => {
    const [description, conditions, expectedSubPath] = testCase
    const resolver = new ExportsResolver(packageJson, { environmentConditions: conditions })
    const actual = resolver.resolveModuleSpecifier('./cjs/index.js')
    assert.deepEqual(actual, expectedSubPath, description)
  })
})

test('condition matching for module URI lookup', assert => {
  const packageJson = {
    name: '@super/module',
    exports: {
      import: {
        one: './src/one/index.js',
        two: './src/two/index.js',
        '.': './src/three/index.js'
      },
      two: './src/four/index.js'
    }
  }

  const testCases = [
    [
      'no match when no matching conditions are present',
      ['default'],
      undefined
    ],
    [
      'matching falls through unmatched condition',
      ['default', 'two'],
      './src/four/index.js'
    ],
    [
      'matching falls through to single condition case',
      ['default', 'import'],
      './src/three/index.js'
    ],
    [
      'all conditions are required to match',
      ['default', 'import', 'two'],
      './src/two/index.js'
    ],
    [
      'condition order does not matter',
      ['one', 'default', 'import'],
      './src/one/index.js'
    ]
  ]

  testCases.forEach(testCase => {
    const [description, conditions, expectedModuleUri] = testCase
    const resolver = new ExportsResolver(packageJson, { environmentConditions: conditions })

    const actualModuleUri = resolver.resolveModuleUri('@super/module')
    assert.deepEqual(actualModuleUri, expectedModuleUri, description)
  })
})

test('basic lookups', assert => {
  const packageJson = {
    name: 'test',
    // use the same 'default' condition for all targets to isolate
    // target pattern matching.
    exports: {
      '.': './dot/index.js',
      './one': './one/index.js',
      './two': './two/index.js'
    }
  }

  const testCases = [
    [
      'first target pattern matched',
      './dot/index.js',
      'test'
    ],
    [
      'middle target pattern matched',
      './one/index.js',
      'test/one'
    ],
    [
      'last target pattern matched',
      './two/index.js',
      'test/two'
    ]
  ]

  testCases.forEach(testCase => {
    const [description, moduleUri, moduleSpecifier] = testCase
    const resolver = new ExportsResolver(packageJson)

    const actualModuleSpecifier = resolver.resolveModuleSpecifier(moduleUri)
    assert.deepEqual(actualModuleSpecifier, moduleSpecifier, description)

    const actualModuleUri = resolver.resolveModuleUri(moduleSpecifier)
    assert.deepEqual(actualModuleUri, moduleUri, description)
  })
})

test('asterisk target pattern matching', assert => {
  const packageJson = {
    name: 'asterisk',
    exports: {
      // makes sure part before asterisk is checked
      // otherwise the next two would match erroneously
      './one/*': './unused/*.js',
      './two/*': './src/features/*.json',
      // three hides four because it is more general
      './three/*': './src/features/*.js',
      './four/*': './src/features/y/*.js',
      // two examples with asterisk last
      './five/*': './slash/*',
      './six*': './slash*',
      // two examples with asterisk first
      './seven/*': '*.json',
      './eight/*': '*.js'
    }
  }

  const testCases = [
    [
      'more general target pattern first wins',
      './src/features/y/y.js', // relative path
      'asterisk/three/y/y' // expected resolved external path
    ],
    [
      'general target pattern',
      './src/features/y.js',
      'asterisk/three/y'
    ],
    [
      'trailing asterisk',
      './slash.js',
      'asterisk/six.js'
    ],
    [
      'more specific target pattern first wins',
      './slash/index.js',
      'asterisk/five/index.js'
    ],
    [
      'asterisk first',
      'index.js',
      'asterisk/eight/index'
    ]
  ]

  testCases.forEach(testCase => {
    const [description, moduleUri, expectedSubPath] = testCase

    const resolver = new ExportsResolver(packageJson)
    const actual = resolver.resolveModuleSpecifier(moduleUri)
    assert.deepEqual(actual, expectedSubPath, description)
  })
})
