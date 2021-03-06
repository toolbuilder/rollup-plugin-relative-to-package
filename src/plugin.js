import { promises } from 'fs'
import { dirname, join, relative, resolve } from 'path'
import picomatch from 'picomatch'
import pkgDir from 'pkg-dir'

// Look for a field in package.json with the ES module path of the package
// First match wins
const getFirstModulePath = (mainFields, packageJson) => {
  const paths = mainFields
    .map(field => packageJson[field])
    .filter(field => field != null)
  return paths[0] // undefined is OK
}

const isModule = (id, module) => id === module
const isPartOfModule = (id, moduleMatcher) => moduleMatcher(id)

// Try id with each extension to see if fn matches one
const matchWithExtensions = (id, extensions, fn) => {
  for (const extension of extensions) {
    if (fn(`${id}${extension}`)) return true
  }
  return false
}

export default (userOptions = {}) => {
  const options = {
    extensions: ['.mjs', '.js', '.json', '.node'], // Same as node-resolve
    mainFields: ['browser', 'jsnext', 'module', 'main'], // Same as node-resolve
    rootDir: undefined, // defaults to first path where package.json is found using pkg-dir
    module: undefined, // defaults to first package.json field (from mainFields) that returns a value
    modulePaths: undefined, // defaults to options.module
    packageName: undefined, // will be read from package.json later if not provided
    ...userOptions
  }
  let moduleMatcher // derived from modulePaths, used to determine whether an id is part of the package module
  return {
    name: 'relative-to-package',
    async buildStart () {
      // Build up default option values now (rather than in factory function) because async calls are required

      options.rootDir = options.rootDir || await pkgDir()
      const needPackageJson = options.module == null || options.packageName == null

      if (needPackageJson) {
        const packageJsonPath = join(options.rootDir, 'package.json')
        const packageJson = JSON.parse(await promises.readFile(packageJsonPath, 'utf-8'))

        options.module = options.module || getFirstModulePath(options.mainFields, packageJson)
        options.packageName = options.packageName || packageJson.name
      }
      options.modulePaths = options.modulePaths || options.module
      moduleMatcher = picomatch(options.modulePaths)
      return options // This is for testing - Rollup does not expect a return value
    },

    async resolveId (id, importer) {
      // Test if id is entry point
      if (importer == null) return null

      // Test if id is external package like 'lodash' or 'zora'
      if (!id.startsWith('.')) return { id, external: true }

      // Now we know id path is relative to importer. Need id path relative to rootDir
      const idPath = resolve(dirname(importer), id) // this is absolute path of id
      const relativeIdPath = relative(options.rootDir, idPath) // this is relative to rootDir

      const extensions = [''].concat(options.extensions) // add null extension in case id already has extension

      // Test if id is the module itself
      if (matchWithExtensions(relativeIdPath, extensions, (testId) => isModule(testId, options.module))) {
        return { id: options.packageName, external: true }
      }

      // Test if id is part of the module that is being imported directly
      if (matchWithExtensions(relativeIdPath, extensions, (testId) => isPartOfModule(testId, moduleMatcher))) {
        // This will be a funny looking import on Windows, since it will have back slashes too
        return { id: `${options.packageName}/${relativeIdPath}`, external: true }
      }

      // id isn't handled by this plugin - let Rollup handle it from here
      return null
    }
  }
}
