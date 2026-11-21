import assert from 'node:assert/strict';
import test from 'node:test';
import svgpath from 'svgpath';
import { readCatalogue } from '../scripts/catalogue.mjs';
import { paintedBounds } from '../scripts/geometry.mjs';
import { markClearance, openingMetrics } from '../scripts/opening-metrics.mjs';
import { solidMetrics } from '../scripts/solid-metrics.mjs';

const catalogue = await readCatalogue();
const icon = (name) => catalogue.find((item) => item.meta.name === name).definition;
const detailNodes = (definition, size, start) =>
  definition.sizes[size].nodes.slice(start).map((_, index) => index + start);
const folderNames = [
  'folder-check',
  'folder-code',
  'folder-ellipsis',
  'folder-heart',
  'folder-key',
  'folder-lock',
  'folder-minus',
  'folder-plus',
  'folder-search',
  'folder-sync',
  'folder-tree',
  'folder-video',
  'folder-warning',
  'folder-x',
];

function assertClear(definition, size, boundary, marks) {
  assert.ok(
    markClearance(definition, size, boundary, marks) >= (size === 16 ? 1 : 1.5) - 2 / 32,
    `${definition.name}/${size}: an internal mark is too close to its frame.`,
  );
}

test('folder variants share their body and leave clear space around internal marks', () => {
  for (const size of [16, 24]) {
    const frame = icon('folder-plus').sizes[size].nodes[0];
    for (const name of folderNames) {
      const definition = icon(name);
      assert.deepEqual(
        definition.sizes[size].nodes[0],
        frame,
        `${name}/${size}: folder body drift.`,
      );
      assertClear(definition, size, [0], detailNodes(definition, size, 1));
    }
    const sync = icon('folder-sync');
    assertClear(sync, size, [1], [2]);
  }
});

test('timer variants share their face and stem while keeping controls clear', () => {
  for (const size of [16, 24]) {
    const base = icon('timer').sizes[size].nodes.slice(0, 2);
    for (const name of ['timer', 'timer-pause', 'timer-play', 'timer-reset']) {
      const definition = icon(name);
      assert.deepEqual(
        definition.sizes[size].nodes.slice(0, 2),
        base,
        `${name}/${size}: timer body drift.`,
      );
      assertClear(definition, size, [0], detailNodes(definition, size, 2));
    }
    for (const name of [
      'alarm-clock',
      'alarm-clock-check',
      'alarm-clock-minus',
      'alarm-clock-plus',
    ]) {
      const definition = icon(name);
      assertClear(definition, size, [0], detailNodes(definition, size, 2));
    }
  }
});

test('plus and minus variants share a centered horizontal stroke and equal cross arms', () => {
  for (const family of ['folder', 'message-circle', 'message-square', 'alarm-clock']) {
    for (const size of [16, 24]) {
      const bounds = ['plus', 'minus'].map((suffix) => {
        const master = icon(`${family}-${suffix}`).sizes[size];
        return paintedBounds({
          ...master,
          nodes: master.nodes.slice(family === 'alarm-clock' ? 2 : 1),
        });
      });
      const [plus, minus] = bounds;
      const same = (a, b) =>
        assert.ok(Math.abs(a - b) < 1e-7, `${family}/${size}: action mark drift.`);
      same(plus[2] - plus[0], plus[3] - plus[1]);
      same(plus[0], minus[0]);
      same(plus[2], minus[2]);
      same(plus[1] + plus[3], minus[1] + minus[3]);
      const master = icon(`${family}-plus`).sizes[size];
      const lines = [];
      const shape = master.nodes.slice(family === 'alarm-clock' ? 2 : 1);
      for (const [tag, attrs] of shape) {
        assert.equal(tag, 'path');
        svgpath(attrs.d)
          .abs()
          .iterate((segment, _index, x, y) => {
            const [command, ...values] = segment;
            if (command === 'M') {
              return;
            }
            assert.ok(['H', 'V', 'L'].includes(command));
            const end =
              command === 'H' ? [values[0], y] : command === 'V' ? [x, values[0]] : values;
            lines.push({ start: [x, y], end });
          });
      }
      assert.equal(lines.length, 2);
      const horizontal = lines.find((line) => line.start[1] === line.end[1]);
      const vertical = lines.find((line) => line.start[0] === line.end[0]);
      assert.ok(horizontal && vertical);
      same((horizontal.start[0] + horizontal.end[0]) / 2, vertical.start[0]);
      same((vertical.start[1] + vertical.end[1]) / 2, horizontal.start[1]);
    }
  }
});

test('repaired detail does not trap cramped white counters', () => {
  for (const name of [
    'corkscrew',
    'eye-off',
    'folder-sync',
    'folder-video',
    'timer-play',
    'timer-reset',
    'sticky-note',
  ]) {
    const definition = icon(name);
    for (const size of [16, 24]) {
      for (const opening of openingMetrics(definition, size)) {
        assert.ok(
          opening.diameter >= (size === 16 ? 1 : 1.5) - 2 / 32,
          `${name}/${size}: a narrow white counter remains.`,
        );
      }
    }
  }
});

test('the sticky note retains a visible white fold', () => {
  for (const size of [16, 24]) {
    const openings = openingMetrics(icon('sticky-note'), size);
    assert.equal(openings.length, 2, `sticky-note/${size}: the paper or fold counter disappeared.`);
    const corner = openings.filter(({ center }) => center.every((value) => value > size * 0.6));
    assert.equal(corner.length, 1, `sticky-note/${size}: the folded corner is no longer open.`);
    assert.ok(corner[0].diameter >= (size === 16 ? 1 : 1.5) - 2 / 32);
  }
});

test('small standalone folder marks remain visible at native pixel densities', () => {
  for (const name of ['folder-ellipsis', 'folder-warning']) {
    for (const size of [16, 24]) {
      for (const dpr of [1, 2]) {
        const marks = solidMetrics(icon(name), size, dpr);
        assert.ok(marks.length > 0);
        for (const mark of marks) {
          assert.ok(mark.peakAlpha >= 128, `${name}/${size}@${dpr}: a solid mark became faint.`);
        }
      }
    }
  }
});

test('the identification portrait stays clear of the card, text and shoulders', () => {
  const definition = icon('id-card');
  for (const size of [16, 24]) {
    assertClear(definition, size, [0], [1]);
    assertClear(definition, size, [1], detailNodes(definition, size, 2));
  }
});
