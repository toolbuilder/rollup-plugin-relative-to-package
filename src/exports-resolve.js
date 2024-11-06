const isString = (item) => typeof item === 'string' || item instanceof String

/**
 * @typedef {object} SubPathData - Provides data associated with a single export subpath.
 * @property {string} subPath - subPath from a single export key
 * @property {Set<string>} conditions - the set of conditions that must be satisfied for the
 * subPath to match a module specifier. These are the conditional export names in package.json
 * that are ok to use for the target of this rollup invocation. See README.md 'conditions' option.
 * @property {string} targetPattern - the target pattern associated with the subPath
 */

/**
 * Converts the exports object to a sequence of data so that entry point lookup
 * is a simple iteration instead of a tree walk.
 *
 * @param {string|Object} exports a package.json exports field
 * @returns {SubPathData[]} - Array is ordered so that entry point lookup using simple iteration
 * is equivalent to a tree walk of the exports object.
 */
const flattenExports = (exports) => {
  const isSubPath = (subPath) => isString(subPath) && subPath.startsWith('.')
  const isCondition = (subPath) => isString(subPath) && !subPath.startsWith('.')
  const isPlainObject = (item) => item != null && item.constructor === Object
  // Convert exports field that is a plain string to the equivalent Object
  const mapPlainString = (exports) => isString(exports) ? { '.': exports } : exports

  // recursive function to walk exports object
  const walkExports = (subPath, conditions, flattened, exports) => {
    const exportsObject = mapPlainString(exports)

    for (const [subPathOrCondition, relativePathOrObject] of Object.entries(exportsObject)) {
      const localConditions = new Set(conditions)
      let localSubPath = subPath
      if (isSubPath(subPathOrCondition)) localSubPath = subPathOrCondition
      if (isCondition(subPathOrCondition)) localConditions.add(subPathOrCondition)
      if (relativePathOrObject == null || isString(relativePathOrObject)) { // TODO: explicit relativePath check
        flattened.push(
          // each module URI (the filepath) gets one of these
          {
            subPath: localSubPath,
            conditions: localConditions,
            targetPattern: relativePathOrObject
          }
        )
      }
      if (isPlainObject(relativePathOrObject)) {
        walkExports(localSubPath, localConditions, flattened, relativePathOrObject)
      }
    }
    return flattened
  }

  return walkExports('.', new Set(['default']), [], exports)
}

/**
 * Determines if the set of conditions used for entry point lookup matches the
 * set of conditions for an export subPath. The set of conditions for the export
 * subPath must be a subset of the conditions used for entry point lookup.
 *
 * @param {Set<string>} lookupConditions - the set of conditions used for entry
 * point lookup. The 'default' condition must always be part of this set.
 * @param {Set<string>} subPathConditions - the set of conditions that must be
 * satisfied for a subPath to be the entry point.
 * @returns {boolean} - true if the subPathConditions are satisified.
 */
const conditionsMatch = (lookupConditions, subPathConditions) => {
  return [...subPathConditions]
    .map(condition => lookupConditions.has(condition))
    .reduce((prev, curr) => prev && curr, true)
}

/**
 * Determine if a moduleUri matches the targetPattern, or if a module specifier
 * matches a sub path pattern. The matching rules are the same for both.
 *
 * @param {string} input - a module URI or module specifier
 * @param {string} pattern - sub path or target pattern
 * @returns {boolean} - true if there is a match
 */
const patternMatches = (input, pattern) => {
  // rightPart is null if there was no asterisk in targetPathPattern
  const [leftPart, rightPart] = pattern.split('*')
  if (rightPart == null) return input === pattern
  return input.startsWith(leftPart) && input.endsWith(rightPart)
}

/**
 * Reverse entry point lookup, starting with the source URI and returning the
 * matching subPath.
 *
 * @param {Set<string>} lookupConditions - the set of conditions used for entry
 * point lookup. The 'default' condition must always be part of this set.
 * @param {SubPathData[]} flattenedExports - the output of flattenExports
 * @param {string} moduleUri - the module URI
 * @returns {string} - the subPath associated with the matching targetPattern
 */
const reverseLookup = (lookupConditions, flattenedExports, moduleUri) => {
  for (const { subPath, conditions, targetPattern } of flattenedExports) {
    if (conditionsMatch(lookupConditions, conditions)) {
      if (patternMatches(moduleUri, targetPattern)) {
        return { subPath, conditions, targetPattern }
      }
    }
  }
  return undefined // no matches
}

/**
 * Entry point lookup, starting with module specifier, and returning the matching
 * module URI.
 *
 * @param {string} pkgName - the name of the package
 * @param {Set<string>} lookupConditions - the set of conditions used for entry
 * point lookup. The 'default' condition must always be part of this set.
 * @param {SubPathData[]} flattenedExports - the output of flattenExports
 * @param {string} moduleUri - the module URI
 * @returns {string} - the module URI associated with the module specifier
 */
const lookup = (pkgName, lookupConditions, flattenedExports, moduleSpecifier) => {
  const specifier = moduleSpecifier.replace(pkgName, '.')
  for (const { subPath, conditions, targetPattern } of flattenedExports) {
    if (conditionsMatch(lookupConditions, conditions)) {
      if (patternMatches(specifier, subPath)) {
        return { subPath, conditions, targetPattern }
      }
    }
  }
  return undefined // no matches
}

/**
 * Given a module URI or a module specifier, and a target pattern, or a
 * subPath pattern, return the part matching the asterisk.
 *
 * @param {string} input - module URI or module specifier
 * @param {string} pattern - subPath pattern, or target pattern
 * @returns {string} - the part matching the asterisk (if any) of pattern.
 * Returns '' if there is no asterisk in pattern.
 */
const extractPatternReplacement = (input, pattern) => {
  const [leftPart, rightPart] = pattern.split('*')
  if (rightPart == null) return '' // there was no asterisk in targetPathPattern
  const extracted = input.replace(leftPart, '').replace(rightPart, '')
  return extracted
}

/**
 * Given a pattern and a pattern replacement, return the string with replacement
 * inserted.
 *
 * @param {string} pattern - either a subPath or a target pattern
 * @param {string} patternReplacement - the results of extractPatternReplacement
 * @returns {string} - substitution results
 */
const insertPatternReplacement = (pattern, patternReplacement) => {
  const [leftPart, rightPart] = pattern.split('*')
  if (rightPart == null) return pattern // there was no asterisk in pathPattern
  return leftPart + patternReplacement + rightPart
}

/**
 * Given a module URI determine the associated module specifier.
 *
 * @param {string} pkgName - name of the package
 * @param {Set<string>} lookupConditions - the set of conditions used for entry
 * point lookup. The 'default' condition must always be part of this set.
 * @param {SubPathData[]} flattenedExports - the output of flattenExports
 * @param {string} moduleUri - the module URI
 * @returns {string} - the associated module specifier or undefined if none
 */
const moduleSpecifierLookup = (pkgName, lookupConditions, flattenExports, moduleUri) => {
  const subPathData = reverseLookup(lookupConditions, flattenExports, moduleUri)
  if (subPathData == null) return undefined
  const { subPath, targetPattern } = subPathData
  const patternReplacement = extractPatternReplacement(moduleUri, targetPattern)
  const moduleSpecifierSubPath = insertPatternReplacement(subPath, patternReplacement)
  return moduleSpecifierSubPath.replace('.', pkgName)
}

const moduleUriLookup = (pkgName, lookupConditions, flattenedExports, moduleSpecifier) => {
  const subPathData = lookup(pkgName, lookupConditions, flattenedExports, moduleSpecifier)
  if (subPathData == null) return undefined
  const { subPath, targetPattern } = subPathData
  const specifier = moduleSpecifier.replace(pkgName, '.')
  if (targetPattern == null) return targetPattern
  const patternReplacement = extractPatternReplacement(specifier, subPath)
  const moduleSpecifierSubPath = insertPatternReplacement(targetPattern, patternReplacement)
  return moduleSpecifierSubPath
}

/**
 * @typedef {object} Options - Specifies options that control export lookup resolution.
 * @property {string[]|undefined} environmentConditions - the set of conditions that must be satisfied for the
 * subPath to match an module specifier
 */

/**
 * Emulates Node's package.json exports field module specifier lookup process, and also works in reverse.
 */
export class ExportsResolver {
  /**
   * Constructor.
   *
   * @param {Object} packageJson - a valid package.json object, only 'name' and 'exports' are required.
   * @param {Options} options - options controlling exports resolution
   */
  constructor (packageJson, options = {}) {
    this.name = packageJson.name
    this.flattenedExports = flattenExports(packageJson.exports)
    this.options = {
      environmentConditions: ['default'],
      ...options
    }
  }

  /**
   * Reverse exports lookup starting with the module URI (e.g. filepath), and finding
   * the module specifier (e.g. package-name/subpath).
   *
   * @param {string} moduleUri - the module URI of the export
   * @returns {string|undefined} - the module specifier if it exists, or undefined
   */
  resolveModuleSpecifier (moduleUri) {
    // doing this conversion here allows user to change conditions after instance is created
    const conditions = new Set(this.options.environmentConditions)
    conditions.add('default') // ensure that default condition is always present
    return moduleSpecifierLookup(this.name, conditions, this.flattenedExports, moduleUri)
  }

  /**
   * Exports lookup starting with the module specifier (e.g. package-name/subpath) and finding
   * the associated module URI.
   *
   * @param {string} moduleSpecifier - module specifier
   * @returns {string|undefined} - the module URI if it exists, or undefined
   */
  resolveModuleUri (moduleSpecifier) {
    const conditions = new Set(this.options.environmentConditions)
    conditions.add('default') // ensure that default condition is always present
    return moduleUriLookup(this.name, conditions, this.flattenedExports, moduleSpecifier)
  }
}
