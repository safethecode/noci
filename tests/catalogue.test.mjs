import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { Resvg } from '@resvg/resvg-js';
import * as esm from 'noci-icons';
import { parseMaster, rasterMetrics, readCatalogue } from '../scripts/catalogue.mjs';

const require = createRequire(import.meta.url);
const catalogue = await readCatalogue();
const metadata = JSON.parse(
  await readFile(new URL('../dist/metadata.json', import.meta.url), 'utf8'),
);

test('canonical icons have distinct artwork', async () => {
  const seen = new Map();
  for (const { meta } of catalogue) {
    const hash = createHash('sha256');
    for (const size of [16, 24]) {
      const svg = await readFile(
        new URL(`../icons/${meta.category}/${meta.name}/${size}.svg`, import.meta.url),
        'utf8',
      );
      hash.update(
        new Resvg(svg, {
          fitTo: { mode: 'zoom', value: 4 },
          font: { loadSystemFonts: false },
        }).render().pixels,
      );
    }
    const fingerprint = hash.digest('hex');
    assert.ok(!seen.has(fingerprint), `${meta.name} duplicates ${seen.get(fingerprint)}.`);
    seen.set(fingerprint, meta.name);
  }
});

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

test('SVG source parser rejects unsafe markup and invalid geometry', () => {
  const base =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">BODY</svg>';
  for (const body of [
    '<script/>',
    '<use href="https://example.com"/>',
    '<path d="M2 2" onclick="x"/>',
    '<path d="M2 2" d="M3 3"/>',
    '<g><path d="M2 2"/></g>',
    '<path d="&xx;"/>',
    '<path d="M2 2L"/>',
    '<path d="M3.1 3H6"/>',
    '<path d="M3 3C3 5 6 6.1 8 6.1H11"/>',
    '<path d="M3 3A2 2 0 2 0 8 8"/>',
    `<path d="M${'9'.repeat(400)} 3L10 10"/>`,
    '<rect x="3.1" y="3" width="6" height="6"/>',
    '<rect x="3" y="3" width="6" height="6" rx="-1"/>',
    `<circle cx="8" cy="8" r="${'9'.repeat(400)}"/>`,
    '<line x1="3.1" y1="3" x2="10" y2="10"/>',
    '<polyline points="3 3 6"/>',
    '<polygon points="3 3 10 10"/>',
  ]) {
    assert.throws(() => parseMaster(base.replace('BODY', body), 16));
  }
  assert.doesNotThrow(() =>
    parseMaster(base.replace('BODY', '<path d="M3 3C3.12 4.67 7.31 8.41 10.17 11.19"/>'), 16),
  );
});

test('solid path marks inherit color and retain a transparent exterior at every export size', () => {
  const source = (size, body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" stroke="currentColor" stroke-width="${size === 16 ? 1.5 : 1.75}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  const path = 'M5.5 4.5L11 7.5Q11.5 8 11 8.5L5.5 11.5Q5 12 5 11V5Q5 4 5.5 4.5Z';
  const mark = `<path d="${path}" fill="currentColor" stroke="none"/>`;
  const icon = {
    name: 'solid-mark-fixture',
    directional: false,
    sizes: {
      16: parseMaster(source(16, mark), 16),
      24: parseMaster(
        source(
          24,
          '<path d="M8.25 6.75L16.5 11.25Q17.25 12 16.5 12.75L8.25 17.25Q7.5 18 7.5 16.5V7.5Q7.5 6 8.25 6.75Z" fill="currentColor" stroke="none"/>',
        ),
        24,
      ),
    },
  };
  for (const size of [16, 24, 48]) {
    for (const color of ['#2563eb', '#f0f6fc']) {
      const rendered = esm.renderIcon(icon, { size }).replace('<svg ', `<svg color="${color}" `);
      const result = new Resvg(rendered, { font: { loadSystemFonts: false } }).render();
      const pixel = (x, y) =>
        Array.from(result.pixels.subarray((y * size + x) * 4, (y * size + x) * 4 + 4));
      const rgb = color
        .slice(1)
        .match(/../g)
        .map((value) => Number.parseInt(value, 16));
      assert.deepEqual(pixel(Math.floor(size / 2), Math.floor(size / 2)), [...rgb, 255]);
      assert.equal(pixel(0, 0)[3], 0);
      assert.equal(pixel(size - 1, size - 1)[3], 0);
    }
  }
  for (const body of [
    mark.replace('Z"', '"'),
    mark.replace(' fill="currentColor"', ''),
    mark.replace(' stroke="none"', ''),
    mark.replace('currentColor', 'red'),
    mark.replace('currentColor', 'url(#paint)'),
    mark.replace('stroke="none"', 'stroke="currentColor"'),
    mark.replace('Z"', 'ZM6 6L8 6L7 8Z"'),
    mark.replace('Z"', 'ZM6 6"'),
    mark.replace('/>', ' fill-rule="evenodd"/>'),
    mark.replace('/>', ' onclick="run()"/>'),
  ]) {
    assert.throws(() => parseMaster(source(16, body), 16));
  }
});
