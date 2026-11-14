import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import assert from 'node:assert/strict';

const metadata = JSON.parse(await readFile(new URL('../dist/metadata.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, 'Runtime dependencies must remain empty.');
assert.equal(pkg.sideEffects, false);
const results = [];
for (const icon of metadata.icons) for (const size of [16, 24, 48]) {
  const bytes = Buffer.byteLength(await readFile(new URL(`../dist/svg/${size}/${icon.name}.svg`, import.meta.url)));
  assert.ok(bytes <= 1600, `${icon.name}/${size}: ${bytes} > 1600 bytes.`);
}
const selected = metadata.icons.slice(0, 2);
for (const count of selected.length ? [1, selected.length] : [0]) for (const style of ['direct', 'barrel']) {
  if (count === 1 && selected.length === 1 && results.some(x => x.style === style)) continue;
  const icons = selected.slice(0, count);
  const imports = style === 'direct'
    ? icons.map((x, i) => `import icon${i} from 'noci-icons/icons/${x.name}';`).join('\n') + "\nimport {renderIcon} from 'noci-icons/core';"
    : `import {renderIcon${icons.map(x => `,${x.exportName}`).join('')}} from 'noci-icons';`;
  const render = icons.map((x, i) => `renderIcon(${style === 'direct' ? `icon${i}` : x.exportName})`).join(',');
  const result = await build({ stdin: { contents: `${imports}\nconsole.log([${render}]);`, resolveDir: new URL('../', import.meta.url).pathname }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', minify: true, metafile: true });
  const code = result.outputFiles[0].contents;
  const gzip = gzipSync(code, { level: 9 }).byteLength;
  const budget = count <= 1 ? 2500 : 3500;
  assert.ok(gzip <= budget, `${count} icons (${style}) exceed ${budget} gzip bytes: ${gzip}.`);
  const liveIcons = Object.entries(result.metafile.inputs).filter(([path]) => /dist\/icons\//.test(path)).filter(([path]) => Object.values(result.metafile.outputs).some(x => (x.inputs[path]?.bytesInOutput ?? 0) > 0));
  assert.equal(liveIcons.length, count, 'Unused icon code must not survive bundling.');
  if (style === 'direct') assert.equal(Object.keys(result.metafile.inputs).filter(x => /dist\/icons\//.test(x)).length, count, 'Direct imports must not traverse other icons.');
  results.push({ style, icons: icons.map(x => x.name), minifiedBytes: code.byteLength, gzipBytes: gzip, budget, liveIconModules: liveIcons.length });
}
await mkdir('artifacts', { recursive: true });
const report = { node: process.version, runtimeDependencies: 0, svgBudgetBytes: 1600, measurements: results };
await writeFile('artifacts/size-report.json', JSON.stringify(report, null, 2) + '\n');
console.table(results.map(x => ({ import: x.style, icons: x.icons.length, bytes: x.minifiedBytes, gzip: x.gzipBytes, budget: x.budget })));
