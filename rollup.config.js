import relativeToImport from './src/plugin.js'

export default {
  input: 'test/plugin.test.js',
  output: {
    file: 'bundle.js',
    format: 'es'
  },
  plugins: [
    relativeToImport({
      src: 'src',
      packageName: '@toolbuilder/rollup-plugin-relative-to-import',
      module: 'src/plugin.js'
    })
  ]
}
