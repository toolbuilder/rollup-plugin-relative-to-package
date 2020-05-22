# Rollup-Plugin-Relative-To-Package

Converts unit tests that use relative imports to use package imports. This is helpful to test the package as a whole when you write code using ES modules, but don't generate CommonJS code. This is the case when you use [esm](https://github.com/standard-things/esm) to load ES modules directly. This plugin is an example of that.

For example the unit test:

```javascript
import YourPackage from '../src/your-package-module'
import { internalFunction } from '../src/inside-your-package'
/* Unit test code goes here */
```

Would be converted to:

```javascript
import YourPackage from 'your-package-name'
import { internalFunction } from 'your-package-name/src/inside-your-package'
/* Unit test code goes here */
```

## Installation

Using npm:

```bash
npm install --save-dev rollup-plugin-relative-to-package
```

## Use

Create a rollup configuration file, and import the plugin.

```javascript
import relativeToPackage from 'rollup-plugin-relative-to-package'

export default {
  // This is the entry point to your unit test - not your package!
  // I use the 'multi-entry' plugin to process all unit tests at once.
  input: 'test/unit-test.js',
  // relativeToPackage determines which packages are external, and
  // gives that information to Rollup. So there is no need to specify it.
  // external: []
  output: {
    dir: 'output',
    format: 'es'
  },
  plugins: [
    relativeToPackage(
      // Tell the plugin which files are part of the package...
      modulePaths: 'src/**/*.js'
    )
  ]
}
```

Then call [Rollup](https://rollupjs.org/guide/en/) however you wish.

This plugin dynamically determines which packages are external, and tells [Rollup](https://rollupjs.org/guide/en/). For example, this plugin will detect `import _ from 'lodash'` as an external import. There is no need to set the Rollup `external` input option.

The Rollup configuration in the root of this package repository uses this plugin to generate a unit test that imports the package.

```bash
pnpm install # I use pnpm. You can use npm and npx if you like
pnpx rollup -c rollup.config.js # will produce test-bundle.js
```

## Options

The plugin works without options. It will look at the closest `package.json` file to figure out values for the `module` and `packageName` options. Those values are probably fine, but you will probably want to set the `modulePaths` option to get the behavior you want.

### extensions

* Type: `Array[...String]`
* Default: `['.mjs', '.js', '.json', '.node']`

Frequently, import ids to not specify the file extension. For example, `import someIdentifier from '../src/module'`, does not specify the file extension. However, the `module` and `modulePaths` options **do** specify file extensions. This leaves the plugin uncertain about whether an import id (e.g. `../src/module`) references part of the package or not. The plugin first tries for a match without adding an extension in case you did specify an extension (e.g. `../src/module.js`). After that, it will append each of the extensions provided by this option to see if there is a match with `modulePaths`. If there is a match, then it will convert the relative import to a package import.

### mainFields

* Type: `Array[...String]`
* Default: `['browser', 'jsnext', 'module', 'main']`

When the plugin looks for the default `module` option value, it will look for these fields in `package.json`. Each field is tried until a match is found. The fields are tried in the order specified.

This plugin does not support Node's experimental [logic](https://nodejs.org/api/esm.html#esm_enabling) for specifying module entry points.

### module

* Type: `String`
* Default: `read from nearest package.json`

This value is the module entry point you would specify if you were building your **module** with [Rollup](https://rollupjs.org/guide/en/). Because you are using this module, we can assume you are not building the module itself, but instead are building unit tests for package testing. In this case, the Rollup option `input` will not provide the correct entry point.

The default module entry point is determined by looking in `package.json` as specified by the `mainFields` option. The search for `package.json` is controlled by the `rootDir` option.

### modulePaths

* Type: `String|Array[...String]
* Default: `the value of the 'module' option`

By default, this option takes on the value of the `module` option. This default value implies that the only file in your package is the module file itself. If that isn't true, you'll need to set this option.

This plugin does not compile your module, so it doesn't know what files are part of your module, and what are used for other purposes. This option tells the plugin which files belong to your module, so it knows when to convert a relative import to a package import.

The `modulePaths` parameters are file match globs that are fed directly to [picomatch](https://github.com/micromatch/picomatch). The `extensions` option documentation describes the match process.

Example `modulePaths` values:

* `'src/index.js'` - the only file in your module is 'src/index.js'.
* `['src/**/*.js']` - your module only contains JavaScript, and all the module source is in the 'src' directory.
* `['src/**/*.js', 'assets/**/*.json']` - your module source is in 'src', and you have 'json' assets in the 'assets' directory too.
* `['index.js', 'helper-code.js']` - your module consists of two files in the package root: 'index.js' and 'helper-code.js'.

### packageName

* Type: `String`
* Default: `read from the nearest package.json`

This value is the package name to use when replacing relative imports with package imports.

The default `packageName` is determined by looking at the `name` field of `package.json`. The search for `package.json` is controlled by the `rootDir` option.

### rootDir

* Type: `String`
* Default: `process.cwd()`

If you do not specify the `module` or `packageName` options, this plugin needs to look at `package.json` to figure out the right values. It will start looking for `package.json` at the `rootDir` value, and continue up the directory structure until it finds one, or stops at the file system boundary. If your `package.json` is somewhere else, set this option.

## Alternatives

I didn't find any. If you know of one, please point it out. Thanks!

## Contributing

Contributions are welcome. Please create a pull request.

I use [pnpm](https://pnpm.js.org/) instead of npm, which is why `pnpm-lock.yaml` exists in the git repo.

## Issues

This project uses Github issues.
