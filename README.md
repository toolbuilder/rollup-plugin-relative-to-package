# Rollup-Plugin-Relative-To-Package

Supports pack file testing by converting unit tests that use relative imports to use package imports where applicable. More technically, it converts moduleURIs to module specifiers when `package.json` provides a mapping in the `exports` declaration.

When a module id is already a module specifier, or this plugin has converted a moduleURI to a module specifier, it tells Rollup that the id is external. As a result, the `external` field is not required in your configuration.

NOTE: Since Node v13.6.0 and v12.16.0, Node supports 'self-referencing', where a module (e.g. a unit test), can import the package module using the package name instead of relative imports. In most (all?) cases, you should be using that feature instead of this plugin. This plugin only processes relative imports. Therefore, if you are using self-referencing imports, this plugin will not affect your Rollup builds.

Here is what the plugin does. Given a unit test that uses relative imports:

```javascript
import YourPackage from '../src/your-package-module.js'
import { internalFunction } from '../src/inside-your-package.js'
/* Unit test code goes here */
```

Convert it to look like this:

```javascript
import YourPackage from 'your-package-name'
import { internalFunction } from 'your-package-name/src/inside-your-package'
/* Unit test code goes here */
```

Your `package.json` export declarations, including any conditions defined in your rollup.js configuration, are used in the resolution process.

## Installation

Using npm:

```bash
npm install --save-dev rollup-plugin-relative-to-package
```

## Upgrading To 1.0.0

Version 1.0.0 makes breaking changes to this plugin.

Options `extensions`, `module`, `mainFields`, and `modulePaths` are no longer supported. In their place are the `exports` and `conditions` fields. The `exports` field is the same as the `package.json` `exports` field, and `conditions` specifies what subPaths are valid exports.

The simplest way to upgrade is to add an `exports` field in your `package.json`, and remove the existing options from your Rollup configuration. You may need to add the `conditions` field if you use special export conditions.

The plugin is now a `dual module` so you can use it from CommonJS and ECMAScript modules.

## Use

Create a rollup configuration file, and import the plugin.

```javascript
import relativeToPackage from 'rollup-plugin-relative-to-package'

export default {
  // This is the entry point to your unit test - not your package!
  // You could use globSync from the glob package (see `rollup.test.config.js`) or
  // use `rollup-plugin-multi-input` to process all unit tests at once.
  input: 'test/unit-test.js',
  // relativeToPackage determines which packages are external, and
  // gives that information to Rollup. So there is no need to specify it.
  // external: (id) => !id.startsWith('.')
  output: {
    dir: 'output',
    format: 'es'
  },
  plugins: [
    // usually, the default values should work just fine
    relativeToPackage({
      conditions: ['default', 'node', 'import', 'production']
    })
  ]
}
```

Then call [Rollup](https://rollupjs.org/guide/en/) however you wish.

This plugin dynamically determines which packages are external, and tells [Rollup](https://rollupjs.org/guide/en/). For example, this plugin will detect `import _ from 'lodash'` as an external import. There is no need to set the Rollup `external` input option.

This [example Rollup configuration](./rollup.config.js) in the root of this repository uses this plugin to generate a unit test that imports the package. Here's how to run it:

```bash
pnpm install # I use pnpm. You can use npm and npx if you like
pnpx rollup -c rollup.config.js # will produce test-bundle.js
```

## Options

The plugin works without options. It will look at the closest `package.json` file to determine the `packageName` and `exports` option values. It is possible that you'll want to provide the `conditions` option if the default values are not sufficient.

### conditions

* Type: `Array[...String]`
* Default: `['default', 'import', 'node', 'node-addons']`

This option completely replaces the default conditions - it does not append to the default conditions. Therefore include all the conditions you need.

The Node [documentation](https://nodejs.org/dist/latest-v14.x/docs/api/packages.html#packages_conditional_exports) describes conditional exports. This option provides the conditions that this plugin will use to resolve the module specifier when it encounters a relative path.

### exports

* Type: `Object`
* Default: by default exports is loaded from the nearest `package.json`

Use this option if the `exports` field in your `package.json` is not suitable for some reason. The `exports` field is documented in the Node [documentation](https://nodejs.org/dist/latest-v14.x/docs/api/packages.html#packages_package_entry_points).

NOTE: This plugin uses the `exports` field in reverse. It uses a module URI (e.g. filepath) to lookup the associated subPath and then generate the import module specifier. That means that this plugin implemented the `exports` field evaluation process, and there might be bugs - please report them. This plugin exports a class `ExportsResolver` that implements forward and backward lookup if that helps.

### packageName

* Type: `String`
* Default: `read from the nearest package.json`

This value is the package name to use when replacing relative imports with package imports.

The default `packageName` is determined by looking at the `name` field of `package.json`. The search for `package.json` is controlled by the `rootDir` option.

### rootDir

* Type: `String`
* Default: `process.cwd()`

If you do not specify the `exports` or `packageName` options, this plugin needs to look at `package.json` to figure out the right values. It will start looking for `package.json` at the `rootDir` value, and continue up the directory structure until it finds one, or stops at the file system boundary. If your `package.json` is somewhere else, set this option.

## Alternatives

As mentioned above, use self-referencing imports on unit tests that test exported functionality. Other than that, I don't know of any alternatives.

## Contributing

Contributions are welcome. Please create a pull request.

I use [pnpm](https://pnpm.js.org/) instead of npm, which is why `pnpm-lock.yaml` exists in the git repo.

## Issues

This project uses Github issues.
