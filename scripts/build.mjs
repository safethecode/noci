import { rm, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { readCatalogue } from './catalogue.mjs';

const root = new URL('../', import.meta.url);
process.chdir(fileURLToPath(root));
const icons = await readCatalogue();
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
await rm('dist', { recursive: true, force: true });
await mkdir('dist/icons', { recursive: true });
await mkdir('dist/sprite', { recursive: true });
for (const size of [16, 24, 48]) await mkdir(`dist/svg/${size}`, { recursive: true });
for (const name of ['core', 'dom']) for (const [format, ext] of [['esm', 'js'], ['cjs', 'cjs']]) {
  const source = (await readFile(`src/${name}.ts`, 'utf8')).replaceAll('./core.js', `./core.${ext}`);
  const compiled = await transform(source, { loader: 'ts', format, target: 'es2022' });
  await writeFile(`dist/${name}.${ext}`, compiled.code);
}
execFileSync('node_modules/.bin/tsc', ['--declaration', '--emitDeclarationOnly', '--outDir', 'dist', '--rootDir', 'src'], { stdio: 'inherit' });
for (const name of ['core', 'dom']) await writeFile(`dist/${name}.d.cts`, (await readFile(`dist/${name}.d.ts`, 'utf8')).replaceAll('./core.js', './core.cjs'));
const { renderIcon, getIconData } = await import(`../dist/core.js?build=${Date.now()}`);
const serial = attrs => Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join('');
const nodesMarkup = nodes => nodes.map(([tag, attrs]) => `<${tag}${serial(attrs)}/>`).join('');
const sprites = { 16: [], 24: [], 48: [] };
for (const icon of icons) {
  const { meta, definition, exportName } = icon;
  const json = JSON.stringify(definition);
  await writeFile(`dist/icons/${meta.name}.js`, `const icon = ${json};\nexport { icon as default, icon as ${exportName} };\n`);
  await writeFile(`dist/icons/${meta.name}.cjs`, `const icon = ${json};\nexports.default = icon;\nexports.${exportName} = icon;\n`);
  await writeFile(`dist/icons/${meta.name}.d.ts`, `import type { IconDefinition } from '../core.js';\ndeclare const icon: IconDefinition;\nexport { icon as default, icon as ${exportName} };\n`);
  await writeFile(`dist/icons/${meta.name}.d.cts`, `import type { IconDefinition } from '../core.cjs';\ndeclare const icon: IconDefinition;\nexport { icon as default, icon as ${exportName} };\n`);
  for (const size of [16, 24, 48]) {
    const opticalSize = size === 16 ? 16 : 24;
    let svg = renderIcon(definition, { size, opticalSize });
    if (size === 48) svg = svg.replace('viewBox="0 0 24 24"', 'viewBox="0 0 48 48"').replace(/(<svg[^>]*>)(.*)<\/svg>/, '$1<g transform="scale(2)">$2</g></svg>');
    await writeFile(`dist/svg/${size}/${meta.name}.svg`, svg + '\n');
    const { attributes, nodes } = getIconData(definition, { size, opticalSize });
    const attrs = { id: `noci-${meta.name}-${size}`, viewBox: `0 0 ${size} ${size}`, fill: 'none', stroke: 'currentColor', 'stroke-width': attributes['stroke-width'], 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    const body = nodesMarkup(nodes);
    sprites[size].push(`<symbol${serial(attrs)}>${size === 48 ? `<g transform="scale(2)">${body}</g>` : body}</symbol>`);
  }
}
await writeFile('dist/index.js', `export * from './core.js';\nexport * from './dom.js';\n` + icons.map(x => `export { default as ${x.exportName} } from './icons/${x.meta.name}.js';\n`).join(''));
await writeFile('dist/index.cjs', `Object.assign(exports, require('./core.cjs'), require('./dom.cjs'));\n` + icons.map(x => `exports.${x.exportName} = require('./icons/${x.meta.name}.cjs').default;\n`).join(''));
await writeFile('dist/index.d.ts', `export * from './core.js';\nexport * from './dom.js';\n` + icons.map(x => `export { default as ${x.exportName} } from './icons/${x.meta.name}.js';\n`).join(''));
await writeFile('dist/index.d.cts', `export * from './core.cjs';\nexport * from './dom.cjs';\n` + icons.map(x => `export { default as ${x.exportName} } from './icons/${x.meta.name}.cjs';\n`).join(''));
for (const size of [16, 24, 48]) await writeFile(`dist/sprite/${size}.svg`, `<svg xmlns="http://www.w3.org/2000/svg">${sprites[size].join('')}</svg>\n`);
await copyFile('src/styles.css', 'dist/styles.css');
await writeFile('dist/metadata.json', JSON.stringify({ version: pkg.version, count: icons.length, icons: icons.map(x => ({ ...x.meta, exportName: x.exportName, sizes: [16, 24, 48], derivedSizes: [48], metrics: x.metrics })) }, null, 2) + '\n');
console.log(`Built ${icons.length} icons · ${icons.length * 2} original masters · ${icons.length * 3} SVG exports.`);
