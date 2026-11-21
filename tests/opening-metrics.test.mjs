import assert from 'node:assert/strict';
import test from 'node:test';
import { markClearance, openingMetrics } from '../scripts/opening-metrics.mjs';

const definition = (nodes, strokeWidth = 1.5) => ({
  name: 'opening-metrics-fixture',
  directional: false,
  sizes: { 16: { strokeWidth, nodes } },
});

test('opening metrics distinguish enclosed counters from open gaps and filled regions', () => {
  const closed = definition([
    ['rect', { x: '3', y: '3', width: '10', height: '2' }],
    ['circle', { cx: '8', cy: '10', r: '2.75' }],
    ['circle', { cx: '8', cy: '10', r: '0.5', fill: 'currentColor', stroke: 'none' }],
  ]);
  const openings = openingMetrics(closed, 16);
  assert.equal(openings.length, 2);
  assert.ok(Math.abs(openings[0].diameter - 0.5) <= 0.0625);
  assert.ok(openings[1].diameter > 1 && openings[1].diameter < 2);
  assert.ok(openings.every((opening) => opening.area > 0));
  assert.ok(openings[0].center[1] > 3 && openings[0].center[1] < 5);
  const open = definition([['path', { d: 'M3 3V5H13V3' }]]);
  assert.deepEqual(openingMetrics(open, 16), []);
  const solid = definition([['path', { d: 'M3 3H13V5H3Z', fill: 'currentColor', stroke: 'none' }]]);
  assert.deepEqual(openingMetrics(solid, 16), []);
});

test('opening metrics find a trapped white wedge created by intersecting strokes', () => {
  const fixture = definition([
    ['path', { d: 'M3 12L8 3L13 12Z' }],
    ['path', { d: 'M5 8H11' }],
  ]);
  const openings = openingMetrics(fixture, 16);
  assert.equal(openings.length, 2);
  assert.ok(openings[0].diameter < openings[1].diameter);
  assert.ok(openings.every((opening) => opening.diameter > 0));
  assert.ok(openings.some((opening) => opening.center[1] < 8));
  assert.ok(openings.some((opening) => opening.center[1] > 8));
});

test('clearance measures painted edges including round caps', () => {
  const fixture = definition([
    ['path', { d: 'M3 4H13' }],
    ['path', { d: 'M3 7H13' }],
    ['path', { d: 'M3 5H13' }],
  ]);
  assert.ok(Math.abs(markClearance(fixture, 16, [0], [1]) - 1.5) <= 0.0625);
  assert.equal(markClearance(fixture, 16, [0], [2]), 0);
  const cap = definition([
    ['path', { d: 'M3 8H6' }],
    ['path', { d: 'M9 8H13' }],
  ]);
  assert.ok(Math.abs(markClearance(cap, 16, [0], [1]) - 1.5) <= 0.0625);
});

test('clearance measures an enclosed solid mark against its frame', () => {
  const fixture = definition([
    ['circle', { cx: '8', cy: '8', r: '5.25' }],
    ['circle', { cx: '8', cy: '8', r: '2.75', fill: 'currentColor', stroke: 'none' }],
  ]);
  assert.ok(Math.abs(markClearance(fixture, 16, [0], [1]) - 1.75) <= 0.0625);
});

test('empty or invalid clearance selections cannot pass a spacing review', () => {
  const fixture = definition([
    ['path', { d: 'M3 4H13' }],
    ['path', { d: 'M8 8' }],
  ]);
  assert.throws(() => markClearance(fixture, 16, [], [0]), /nonempty node selections/);
  assert.throws(() => markClearance(fixture, 16, [0], [2]), /valid, nonempty/);
  assert.throws(() => markClearance(fixture, 16, [0], [1]), /painted artwork/);
  const sparse = [0];
  sparse.length = 2;
  assert.throws(() => markClearance(fixture, 16, [0], sparse), /valid, nonempty/);
});
