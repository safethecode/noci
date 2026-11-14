import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
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
assert.ok(metadata.icons.length > 0, 'Payload measurement needs real icons.');
const largest = [...metadata.icons].sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length).slice(0, 2);
const cases = [...metadata.icons.map(x => [x]), ...(largest.length > 1 ? [largest] : [])];
for (const icons of cases) for (const style of ['direct', 'barrel']) {
  const count = icons.length;
  const imports = style === 'direct'
    ? icons.map((x, i) => `import icon${i} from 'noci-icons/icons/${x.name}';`).join('\n') + "\nimport {renderIcon} from 'noci-icons/core';"
    : `import {renderIcon${icons.map(x => `,${x.exportName}`).join('')}} from 'noci-icons';`;
  const render = icons.map((x, i) => `renderIcon(${style === 'direct' ? `icon${i}` : x.exportName})`).join(',');
  const result = await build({ stdin: { contents: `${imports}\nconsole.log([${render}]);`, resolveDir: fileURLToPath(new URL('../', import.meta.url)) }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', minify: true, metafile: true });
  const code = result.outputFiles[0].contents;
  const gzip = gzipSync(code, { level: 9 }).byteLength;
  const budget = count <= 1 ? 2500 : 3500;
  assert.ok(gzip <= budget, `${count} icons (${style}) exceed ${budget} gzip bytes: ${gzip}.`);
  const liveIcons = Object.entries(result.metafile.inputs).filter(([path]) => /dist\/icons\//.test(path)).filter(([path]) => Object.values(result.metafile.outputs).some(x => (x.inputs[path]?.bytesInOutput ?? 0) > 0));
  assert.equal(liveIcons.length, count, 'Unused icon code must not survive bundling.');
  if (style === 'direct') assert.equal(Object.keys(result.metafile.inputs).filter(x => /dist\/icons\//.test(x)).length, count, 'Direct imports must not traverse other icons.');
  results.push({ style, icons: icons.map(x => x.name), minifiedBytes: code.byteLength, gzipBytes: gzip, budget, liveIconModules: liveIcons.length });
}
if (metadata.icons.length > 1) {
  const eager = metadata.icons[0], lazy = metadata.icons.at(-1);
  const split = await build({ stdin: { contents: `import icon from 'noci-icons/icons/${eager.name}';export const eager=icon;export const later=()=>import('noci-icons/icons/${lazy.name}');`, resolveDir: fileURLToPath(new URL('../', import.meta.url)) }, bundle: true, splitting: true, write: false, outdir: 'out', format: 'esm', metafile: true });
  const entry = Object.values(split.metafile.outputs).find(x => x.entryPoint === '<stdin>');
  assert.ok(entry, 'Code splitting must produce an entry chunk.');
  assert.ok(!Object.keys(entry.inputs).some(x => x.endsWith(`/icons/${lazy.name}.js`)), 'Lazy icon must not be included in the eager chunk.');
}
await mkdir('artifacts', { recursive: true });
const report = { node: process.version, runtimeDependencies: 0, svgBudgetBytes: 1600, measurements: results };
await writeFile('artifacts/size-report.json', JSON.stringify(report, null, 2) + '\n');
console.table(['direct', 'barrel'].map(style => {
  const singles = results.filter(x => x.style === style && x.icons.length === 1);
  const worst = singles.reduce((a, b) => a.gzipBytes > b.gzipBytes ? a : b);
  return { import: style, measuredIcons: singles.length, worstIcon: worst.icons[0], maxGzip: worst.gzipBytes, budget: worst.budget };
}));
