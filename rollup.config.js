import relativeToImport from 'rollup-plugin-relative-to-package'
/*
  This is a simple Rollup example configuration that converts the
  unit test 'test/plugin.test.js' from relative imports to package
  imports. Just run 'npx rollup -c rollup.config.js' and it will
  output the converted unit test in this directory.
*/
export default {
  input: 'test/plugin.test.js',
  output: {
    file: 'test-bundle.js',
    format: 'es'
  },
  plugins: [
    relativeToImport() // Turns out that all defaults work here
  ]
}
