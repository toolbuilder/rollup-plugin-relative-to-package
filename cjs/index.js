const { ExportsResolver, relativeToPackage } = require('./plugin.js')

// The Rollup plugin is configured to produce named exports - no default
// Rollup users typically expect a default export from a plugin, so
// add support for default require, as well as named
const defaultFunction = (userOptions) => relativeToPackage(userOptions)
defaultFunction.ExportsResolver = ExportsResolver
defaultFunction.relativeToPackage = relativeToPackage
module.exports = defaultFunction
