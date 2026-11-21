import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { readCatalogue } from '../scripts/catalogue.mjs';
import { paintedBounds } from '../scripts/geometry.mjs';

const pathMaster = (d) => ({ strokeWidth: 1.5, nodes: [['path', { d }]] });

function assertBounds(master, expected) {
  const actual = paintedBounds(master);
  assert.ok(actual);
  for (let axis = 0; axis < 4; axis++) {
    assert.ok(
      Math.abs(actual[axis] - expected[axis]) < 1e-7,
      `Bound ${axis}: expected ${expected[axis]}, received ${actual[axis]}.`,
    );
  }
}

test('round caps and joins include half the stroke width', () => {
  assertBounds(pathMaster('M4 6h5v3Z'), [3.25, 5.25, 9.75, 9.75]);
  assertBounds(pathMaster('M8 8L8 8'), [7.25, 7.25, 8.75, 8.75]);
  assertBounds(pathMaster('M8 8Z'), [7.25, 7.25, 8.75, 8.75]);
  assertBounds(pathMaster('M8 8A2 2 0 0 1 8 8'), [7.25, 7.25, 8.75, 8.75]);
  assertBounds(pathMaster('M4 6h5M100 100'), [3.25, 5.25, 9.75, 6.75]);
  assert.equal(paintedBounds(pathMaster('M100 100')), null);
});

test('primitive bounds account for stroke and solid marks separately', () => {
  const master = (tag, attrs) => ({ strokeWidth: 1.5, nodes: [[tag, attrs]] });
  assertBounds(master('circle', { cx: '8', cy: '8', r: '2' }), [5.25, 5.25, 10.75, 10.75]);
  assertBounds(
    master('circle', { cx: '8', cy: '8', r: '2', fill: 'currentColor', stroke: 'none' }),
    [6, 6, 10, 10],
  );
  assertBounds(
    master('rect', { x: '4', y: '5', width: '6', height: '3', rx: '1' }),
    [3.25, 4.25, 10.75, 8.75],
  );
  assertBounds(master('line', { x1: '4', y1: '6', x2: '9', y2: '9' }), [3.25, 5.25, 9.75, 9.75]);
  for (const tag of ['polygon', 'polyline']) {
    assertBounds(master(tag, { points: '5,3 11,9 5,9' }), [4.25, 2.25, 11.75, 9.75]);
  }
});

test('Bezier bounds use curve extrema rather than control points', () => {
  assertBounds(pathMaster('M4 8C4 0 12 0 12 8'), [3.25, 1.25, 12.75, 8.75]);
  assertBounds(pathMaster('M4 8Q8 0 12 8'), [3.25, 3.25, 12.75, 8.75]);
  assertBounds(pathMaster('M4 8q2-8 4 0t4 0'), [3.25, 3.25, 12.75, 12.75]);
  assertBounds(pathMaster('M4 8C4 0 8 0 8 8S12 16 12 8'), [3.25, 1.25, 12.75, 14.75]);
});

test('rotated ellipse bounds preserve the true arc geometry', () => {
  const near = 8 - 2 * Math.SQRT2;
  const far = 8 + 2 * Math.SQRT2;
  const radius = Math.sqrt(10) + 0.75;
  assertBounds(pathMaster(`M${far} ${far}A4 2 45 0 1 ${near} ${near}A4 2 45 0 1 ${far} ${far}`), [
    8 - radius,
    8 - radius,
    8 + radius,
    8 + radius,
  ]);
});

test('arc flags restrict extrema to the selected sweep', () => {
  assertBounds(pathMaster('M12 8A4 2 0 0 1 8 10'), [7.25, 7.25, 12.75, 10.75]);
  assertBounds(pathMaster('M12 8A4 2 0 1 1 8 10'), [7.25, 7.25, 16.75, 12.75]);
  assertBounds(pathMaster('M12 8A4 2 0 1 0 8 10'), [3.25, 5.25, 12.75, 10.75]);
});

test('undersized arc radii expand according to SVG geometry', () => {
  assertBounds(pathMaster('M3 8A1 1 0 0 1 13 8'), [2.25, 2.25, 13.75, 8.75]);
  assertBounds(pathMaster('M3 8A1 1 0 0 0 13 8'), [2.25, 7.25, 13.75, 13.75]);
  assertBounds(pathMaster('M3 8A0 2 0 0 1 13 8'), [2.25, 7.25, 13.75, 8.75]);
});

test('arc calculations reject numeric overflow instead of skipping extrema', () => {
  for (const radius of ['1'.padEnd(201, '0'), `0.${'0'.repeat(199)}1`]) {
    assert.throws(
      () => paintedBounds(pathMaster(`M4 8A${radius} ${radius} 0 1 1 12 8`)),
      /numeric range/,
    );
  }
});

test('catalogue loading rejects subpixel protrusions beyond the drawing frame', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'noci-geometry-'));
  const folder = join(directory, 'foundation', 'geometry-fixture');
  const source = (size, radius) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" stroke="currentColor" stroke-width="${size === 16 ? 1.5 : 1.75}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="${size / 2}" cy="${size / 2}" r="${radius}"/></svg>`;
  try {
    await mkdir(folder, { recursive: true });
    const meta = JSON.parse(
      await readFile(new URL('../icons/foundation/circle/meta.json', import.meta.url), 'utf8'),
    );
    meta.name = 'geometry-fixture';
    await writeFile(join(folder, 'meta.json'), JSON.stringify(meta));
    await writeFile(join(folder, '16.svg'), source(16, 5.25));
    await writeFile(join(folder, '24.svg'), source(24, 8.125));
    const root = pathToFileURL(`${directory}/`);
    assert.equal((await readCatalogue(root)).length, 1);
    await writeFile(join(folder, '16.svg'), source(16, 5.26));
    await assert.rejects(readCatalogue(root), /geometry-fixture\/16: .*safe inset/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
