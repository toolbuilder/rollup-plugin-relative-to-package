import { isAbsolute } from 'node:path'

/**
 * Determine if Rollup has provided a bare module specifier.
 *
 * @param {string} id the import id provided by Rollup
 * @returns true if id is a module specifier (i.e. bare import)
 */
export const isModuleSpecifier = (id) => {
  const relative = id.startsWith('.')
  const absolute = isAbsolute(id)
  const bare = !(relative || absolute)
  return bare // bare means module specifier
}
