import { promises } from 'fs'
import { dirname, join, parse, relative, resolve } from 'path'
import pkgDir from 'pkg-dir'

const removeExtension = (path) => {
  const parts = parse(path)
  return join(parts.root, parts.dir, parts.name)
}

export default (userOptions = {}) => {
  const options = { ...userOptions }

  return {
    async buildStart () {
      options.packageDir = options.packageDir || await pkgDir()
      if (options.module == null || options.packageName == null) {
        const packageJsonPath = join(options.packageDir, 'package.json')
        const packageJson = JSON.parse(await promises.readFile(packageJsonPath, 'utf-8'))
        // packageJson.main can be entry point if you're using *.mjs files, and don't
        // put an extension on the main property. Not checking all that.
        options.module = options.module || packageJson.module || packageJson.main
        options.packageName = options.packageName || packageJson.name
        console.log(options.module, options.packageName)
      }
      options.module = removeExtension(options.module) // Remove extension, if present, to simplify resolveId
    },

    async resolveId (id, importer) {
      if (importer == null) return null // id is the entry point in this case

      const trimmedId = removeExtension(id) // Remove extension, if present, to simplify code.
      if (!id.startsWith('.')) return { id: trimmedId, external: true } // id is an external package

      if (id.startsWith('./')) return null // id is non-module helper, let rollup handle it

      // Have id path relative to importer. Need path relative to packageDir
      const idPath = resolve(dirname(importer), trimmedId) // this is absolute path of id
      const relativeIdPath = relative(options.packageDir, idPath) // this is relative to packageDir

      if (relativeIdPath === options.module) return { id: options.packageName, external: true }
      return { id: `${options.packageName}/${relativeIdPath}`, external: true }
    }
  }
}
