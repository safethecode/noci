import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const metadata = JSON.parse(
  await readFile(new URL('../dist/metadata.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(
  Object.keys(pkg.dependencies ?? {}).length,
  0,
  'Runtime dependencies must remain empty.',
);
assert.equal(pkg.sideEffects, false);
const results = [];
for (const icon of metadata.icons) {
  for (const size of [16, 24, 48]) {
    const bytes = Buffer.byteLength(
      await readFile(new URL(`../dist/svg/${size}/${icon.name}.svg`, import.meta.url)),
    );
    assert.ok(bytes <= 1600, `${icon.name}/${size}: ${bytes} > 1600 bytes.`);
  }
}
assert.ok(metadata.icons.length > 0, 'Payload measurement needs real icons.');
const weighted = await Promise.all(
  metadata.icons.map(async (icon) => ({
    icon,
    bytes: Buffer.byteLength(
      await readFile(new URL(`../dist/icons/${icon.name}.js`, import.meta.url)),
    ),
  })),
);
const largest = weighted
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 2)
  .map((x) => x.icon);
const cases = [...metadata.icons.map((x) => [x]), ...(largest.length > 1 ? [largest] : [])];
const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = cases.flatMap((icons) =>
  ['direct', 'barrel'].map((style) => {
    const imports =
      style === 'direct'
        ? icons.map((x, i) => `import icon${i} from 'noci-icons/icons/${x.name}';`).join('\n') +
          "\nimport {renderIcon} from 'noci-icons/core';"
        : `import {renderIcon${icons.map((x) => `,${x.exportName}`).join('')}} from 'noci-icons';`;
    const render = icons
      .map((x, i) => `renderIcon(${style === 'direct' ? `icon${i}` : x.exportName})`)
      .join(',');
    return { icons, style, contents: `${imports}\nconsole.log([${render}]);` };
  }),
);
const bundled = await build({
  absWorkingDir: root,
  entryPoints: fixtures.map((_, i) => ({ in: `noci-size-${i}`, out: `case-${i}` })),
  bundle: true,
  write: false,
  outdir: 'artifacts/size',
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  metafile: true,
  plugins: [
    {
      name: 'size-fixtures',
      setup(build) {
        build.onResolve({ filter: /^noci-size-\d+$/ }, ({ path }) => ({
          path,
          namespace: 'size-fixture',
        }));
        build.onLoad({ filter: /.*/, namespace: 'size-fixture' }, ({ path }) => ({
          contents: fixtures[Number(path.slice('noci-size-'.length))].contents,
          loader: 'js',
          resolveDir: root,
        }));
      },
    },
  ],
});
const files = new Map(bundled.outputFiles.map((file) => [file.path, file.contents]));
const measured = new Set();
for (const [path, output] of Object.entries(bundled.metafile.outputs)) {
  const match = /^size-fixture:noci-size-(\d+)$/.exec(output.entryPoint ?? '');
  assert.ok(match, `Unexpected payload output: ${path}.`);
  const index = Number(match[1]);
  assert.ok(!measured.has(index), `Duplicate payload output: ${index}.`);
  measured.add(index);
  const { icons, style } = fixtures[index];
  const count = icons.length;
  const code = files.get(resolve(root, path));
  assert.ok(code, `Missing payload output: ${path}.`);
  const gzip = gzipSync(code, { level: 9 }).byteLength;
  const budget = count <= 1 ? 2500 : 3500;
  assert.ok(gzip <= budget, `${count} icons (${style}) exceed ${budget} gzip bytes: ${gzip}.`);
  const liveIcons = Object.entries(output.inputs).filter(
    ([path, input]) => /dist\/icons\//.test(path) && input.bytesInOutput > 0,
  );
  assert.equal(liveIcons.length, count, 'Unused icon code must not survive bundling.');
  if (style === 'direct') {
    const visited = new Set();
    const pending = [output.entryPoint];
    while (pending.length) {
      const path = pending.pop();
      if (visited.has(path)) {
        continue;
      }
      visited.add(path);
      const input = bundled.metafile.inputs[path];
      assert.ok(input, `Missing input graph: ${path}.`);
      for (const dependency of input.imports) {
        if (!dependency.external) {
          pending.push(dependency.path);
        }
      }
    }
    assert.equal(
      [...visited].filter((path) => /dist\/icons\//.test(path)).length,
      count,
      'Direct imports must not traverse other icons.',
    );
  }
  results.push({
    style,
    icons: icons.map((x) => x.name),
    minifiedBytes: code.byteLength,
    gzipBytes: gzip,
    budget,
    liveIconModules: liveIcons.length,
  });
}
assert.equal(measured.size, fixtures.length, 'Every payload fixture must be measured.');
if (metadata.icons.length > 1) {
  const eager = metadata.icons[0],
    lazy = metadata.icons.at(-1);
  const split = await build({
    stdin: {
      contents: `import icon from 'noci-icons/icons/${eager.name}';export const eager=icon;export const later=()=>import('noci-icons/icons/${lazy.name}');`,
      resolveDir: fileURLToPath(new URL('../', import.meta.url)),
    },
    bundle: true,
    splitting: true,
    write: false,
    outdir: 'out',
    format: 'esm',
    metafile: true,
  });
  const entry = Object.values(split.metafile.outputs).find((x) => x.entryPoint === '<stdin>');
  assert.ok(entry, 'Code splitting must produce an entry chunk.');
  assert.ok(
    !Object.keys(entry.inputs).some((x) => x.endsWith(`/icons/${lazy.name}.js`)),
    'Lazy icon must not be included in the eager chunk.',
  );
}
await mkdir('artifacts', { recursive: true });
const report = {
  node: process.version,
  runtimeDependencies: 0,
  svgBudgetBytes: 1600,
  measurements: results,
};
await writeFile('artifacts/size-report.json', `${JSON.stringify(report, null, 2)}\n`);
console.table(
  ['direct', 'barrel'].map((style) => {
    const singles = results.filter((x) => x.style === style && x.icons.length === 1);
    const worst = singles.reduce((a, b) => (a.gzipBytes > b.gzipBytes ? a : b));
    return {
      import: style,
      measuredIcons: singles.length,
      worstIcon: worst.icons[0],
      maxGzip: worst.gzipBytes,
      budget: worst.budget,
    };
  }),
);
