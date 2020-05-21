import relativeToImport from './src/plugin.js'

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
