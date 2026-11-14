# Package structure

`icons/` contains the SVG sources and metadata. `src/core.ts` provides the string renderer and icon data. `src/dom.ts` creates SVG elements in a browser.

The build generates ESM and CommonJS modules, TypeScript declarations, SVG files at 16/24/48px and SVG sprites. Each icon has a direct import path. Catalogue metadata is a separate export.

The package has no runtime dependencies. Importing it does not scan the DOM, register custom elements, access browser globals or make network requests.

## Size limits

- Individual SVG: up to 1,600 bytes.
- One icon and the renderer: up to 2,500 gzip bytes.
- Two icons and the renderer: up to 3,500 gzip bytes.

`npm run size` checks these limits and verifies tree shaking and lazy imports. `npm run check` also checks formatting, lint rules, types, SVG sources and installation of the generated package.
