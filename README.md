# Noci

SVG icons for web interfaces. Each icon includes 16px and 24px designs, with a 48px export.

[한국어](README.ko.md) · [Design guidelines](DESIGN.md) · [Accessibility](docs/accessibility.md) · [Contributing](CONTRIBUTING.md)

## Use an icon

```js
import check from 'noci-icons/icons/check';
import { renderIcon } from 'noci-icons/core';

renderIcon(check, { size: 16 });
renderIcon(check, { size: 24, label: 'Completed' });
```

Omit `label` for decorative icons. Name icon-only buttons on the button and keep the SVG decorative.

For browser DOM rendering:

```js
import { createIcon } from 'noci-icons/dom';

container.replaceChildren(createIcon(check, { size: 16 }));
```

Direct imports load only the selected icon. ESM, CommonJS and TypeScript declarations are included. The package has no runtime dependencies.

## SVG files

Use `noci-icons/svg/16/check.svg`, `noci-icons/svg/24/check.svg` or `noci-icons/svg/48/check.svg`. SVG sprites and a separate `metadata.json` export are also included.

Inline SVG inherits `currentColor`. External images need an appropriate `alt` attribute. See [integration examples](docs/integration.md) for framework usage.

## Development

Requires Node.js 22 or later. The package is not yet published to npm.

```sh
npm ci
npm run format
npm run check
npm run browsers:install
npm run test:browser
npm run qa
```

`npm pack` creates a package for local installation. Generated files and test output are excluded from Git.

Run `npm run preview` to browse the collection at <http://127.0.0.1:4173>. Compare
icons at 16, 24, 32 and 48px, try your own text, and copy or download individual SVGs.
Set `NOCI_PREVIEW_PORT` to use another port.

## License

[MIT](LICENSE)
