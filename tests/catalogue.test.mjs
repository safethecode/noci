import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as esm from 'noci-icons';
import { parseMaster, rasterMetrics, readCatalogue } from '../scripts/catalogue.mjs';

const require = createRequire(import.meta.url);
const catalogue = await readCatalogue();
const metadata = JSON.parse(
  await readFile(new URL('../dist/metadata.json', import.meta.url), 'utf8'),
);

test('metadata and public module surfaces describe exactly the same catalogue', () => {
  assert.deepEqual(
    metadata.icons.map((x) => x.name),
    catalogue.map((x) => x.meta.name),
  );
  const expected = [
    'getIconData',
    'renderIcon',
    'createIcon',
    ...catalogue.map((x) => x.exportName),
  ].sort();
  assert.deepEqual(Object.keys(esm).sort(), expected);
  assert.deepEqual(Object.keys(require('noci-icons')).sort(), expected);
});

test('each direct entry resolves in native Node ESM and CJS', async () => {
  for (const { meta, definition, exportName } of catalogue) {
    const entry = await import(`noci-icons/icons/${meta.name}`);
    const cjs = require(`noci-icons/icons/${meta.name}`);
    assert.deepEqual(entry.default, definition);
    assert.deepEqual(cjs.default, definition);
    assert.deepEqual(entry[exportName], esm[exportName]);
    assert.deepEqual(cjs[exportName], definition);
  }
});

test('static 48px exports have a true 48 viewBox and preserve doubled geometry', async () => {
  for (const { meta } of catalogue) {
    const small = await readFile(
      new URL(`../dist/svg/24/${meta.name}.svg`, import.meta.url),
      'utf8',
    );
    const large = await readFile(
      new URL(`../dist/svg/48/${meta.name}.svg`, import.meta.url),
      'utf8',
    );
    assert.match(large, /viewBox="0 0 48 48"/);
    // Compare at the same physical resolution (384px). Different resolutions have
    // different antialiasing and cannot establish whether a vector was translated.
    const a = rasterMetrics(small, 24, 16),
      b = rasterMetrics(large, 48, 8);
    assert.ok(Math.abs(a.density - b.density) < 0.002);
    for (let i = 0; i < 2; i++) {
      assert.ok(
        Math.abs(a.centroid[i] * 2 - b.centroid[i]) < 0.03,
        `${meta.name}: axis ${i} changed center.`,
      );
    }
  }
});

test('circular status families retain the foundation keyline', () => {
  const circle = catalogue.find((x) => x.meta.name === 'circle');
  for (const item of catalogue.filter((x) =>
    ['clock', 'info', 'check-circle', 'universal-access'].includes(x.meta.name),
  )) {
    for (const size of [16, 24]) {
      assert.deepEqual(
        item.definition.sizes[size].nodes[0],
        circle.definition.sizes[size].nodes[0],
        `${item.meta.name}/${size}: circle family drift.`,
      );
    }
  }
});

test('script variants retain the same letter baseline in toolbars', () => {
  const sub = catalogue.find((x) => x.meta.name === 'subscript'),
    sup = catalogue.find((x) => x.meta.name === 'superscript');
  if (!sub || !sup) {
    return;
  }
  for (const size of [16, 24]) {
    assert.deepEqual(
      sub.definition.sizes[size].nodes[0],
      sup.definition.sizes[size].nodes[0],
      `${size}: base letter drifted.`,
    );
  }
});

test('sprite IDs and natural sizes are exhaustive and unique', async () => {
  for (const size of [16, 24, 48]) {
    const sprite = await readFile(new URL(`../dist/sprite/${size}.svg`, import.meta.url), 'utf8');
    const ids = [...sprite.matchAll(/id="([^"]+)"/g)].map((x) => x[1]);
    assert.equal(new Set(ids).size, catalogue.length);
    for (const { meta } of catalogue) {
      assert.ok(ids.includes(`noci-${meta.name}-${size}`));
    }
  }
});

test('SVG source parser rejects scripts, refs, duplicate attributes and unsupported markup', () => {
  const base =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">BODY</svg>';
  for (const body of [
    '<script/>',
    '<use href="https://example.com"/>',
    '<path d="M2 2" onclick="x"/>',
    '<path d="M2 2" d="M3 3"/>',
    '<g><path d="M2 2"/></g>',
    '<path d="&xx;"/>',
  ]) {
    assert.throws(() => parseMaster(base.replace('BODY', body), 16));
  }
});
