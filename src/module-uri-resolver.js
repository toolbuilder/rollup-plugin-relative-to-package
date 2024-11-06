import { dirname, relative, resolve } from 'path'

/**
 * Convert a full path or path relative to importer to a path relative to rootDir.
 * The moduleUri may, or may not, be reachable via a module specifer,
 * depending on the exports mapping provided in package.json.
 *
 * @param {string} id - moduleUri (not module specifier) provided by rollup.js
 * @param {string} importer - full path to importer of moduleUri
 * @param {string} rootDir - full path to package root directory
 * @returns moduleUri relative to rootDir
 */
export const moduleUriResolver = (id, importer, rootDir) => {
  const idPath = resolve(dirname(importer), id)
  const relativeToRootDir = relative(rootDir, idPath)
  if (relativeToRootDir.startsWith('../')) return relativeToRootDir
  return `./${relativeToRootDir}`
}
