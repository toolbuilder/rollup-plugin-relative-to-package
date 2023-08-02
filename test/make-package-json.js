/*
  This is the test package.json for 'plugin.test.js' tests
  that read the filesystem. It really only needs the name and exports field
*/
export default {
  name: '@super-scope/awesome-package',
  version: '0.1.0-rc0',
  keywords: [],
  license: 'MIT',
  main: 'index.js',
  module: 'src/index.js',
  exports: {
    require: './index.js',
    default: './src/index.js'
  },
  files: [
    'src'
  ],
  scripts: {
    build: 'npm-run-all --serial test lint',
    lint: 'eslint src test',
    test: 'tape -r esm "test/*.test.js"'
  },
  eslintConfig: {
    extends: '@toolbuilder/eslint-config'
  },
  dependencies: {
    esm: '^3.2.25'
  },
  devDependencies: {
    '@toolbuilder/eslint-config': '>=0.1.2',
    eslint: '>=6.8.0',
    'npm-run-all': '^4.1.5',
    tape: '^5.0.0',
    zora: '^3.1.8'
  }
}
