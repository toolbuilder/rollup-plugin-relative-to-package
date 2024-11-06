import { promises } from 'node:fs'
import { join } from 'node:path'
import pkgDir from 'pkg-dir'
import { isModuleSpecifier } from './module-specifier.js'
import { moduleUriResolver } from './module-uri-resolver.js'
import { ExportsResolver } from './exports-resolve.js'
// export ExportsResolver from here to make CJS packaging easier
export { ExportsResolver } from './exports-resolve.js'

export const relativeToPackage = (userOptions = {}) => {
  // Final options and resolver are determined asynchronously,
  // so they are uninitialized until buildStart is called
  const options = {
    rootDir: undefined, // defaults to first path where package.json is found using pkg-dir
    packageName: undefined, // will be read from package.json later if not provided
    exports: undefined, // will be read from package.json later if not provided
    conditions: ['default', 'import', 'node', 'node-addons'], // node's supported conditions
    ...userOptions
  }
  let resolver // will be initialized in buildStart when we have enough information, used in resolveId

  return {
    name: 'relative-to-package',
    async buildStart () {
      // Build up default option values now (rather than in factory function) because async calls are required

      options.rootDir = options.rootDir || await pkgDir()
      const needPackageJson = options.exports == null || options.packageName == null

      if (needPackageJson) {
        const packageJsonPath = join(options.rootDir, 'package.json')
        const packageJson = JSON.parse(await promises.readFile(packageJsonPath, 'utf-8'))

        options.exports = options.exports || packageJson.exports || packageJson.main
        options.packageName = options.packageName || packageJson.name
      }
      const partialPackageJson = { name: options.packageName, exports: options.exports }
      const resolverOptions = { environmentConditions: options.conditions }
      resolver = new ExportsResolver(partialPackageJson, resolverOptions)
      return options // This is for testing - Rollup does not expect a return value
    },

    async resolveId (id, importer) {
      // Test if id is entry point
      if (importer == null) return null
      if (isModuleSpecifier(id)) return { id, external: true }

      const moduleUri = moduleUriResolver(id, importer, options.rootDir)

      // lookup module specifier (e.g. packageName/subPath) for moduleUri
      const moduleSpecifier = resolver.resolveModuleSpecifier(moduleUri)

      // tell Rollup this is an external package, and how to import it (e.g. packageName/subPath)
      if (moduleSpecifier) return { id: moduleSpecifier, external: true }

      // id isn't handled by this plugin - let Rollup handle it from here
      return null
    }
  }
}

export default relativeToPackage
