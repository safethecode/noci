import assert from 'node:assert/strict';
import test from 'node:test';
import { solidMetrics } from '../scripts/solid-metrics.mjs';

test('solid metrics isolate faint and empty marks from opaque surrounding artwork', () => {
  const fixture = (center) => ({
    name: 'solid-metrics-fixture',
    directional: false,
    sizes: {
      16: {
        strokeWidth: 1.5,
        nodes: [
          ['circle', { cx: '8', cy: '8', r: '5.25' }],
          ['circle', { cx: center, cy: center, r: '0.5', fill: 'currentColor', stroke: 'none' }],
          ['path', { d: 'M4 4L12 8L4 12Z', fill: 'currentColor', stroke: 'none' }],
          ['path', { d: 'M8 8Z', fill: 'currentColor', stroke: 'none' }],
        ],
      },
    },
  });
  const faint = solidMetrics(fixture('8'), 16, 1);
  assert.deepEqual(
    faint.map((mark) => mark.nodeIndex),
    [1, 2, 3],
  );
  assert.ok(faint[0].peakAlpha > 0 && faint[0].peakAlpha < 128);
  assert.equal(faint[1].peakAlpha, 255);
  assert.equal(faint[2].peakAlpha, 0);
  assert.equal(faint[2].inkArea, 0);
  const aligned = solidMetrics(fixture('8.5'), 16, 1);
  assert.ok(aligned[0].peakAlpha >= 128);
  const doubled = solidMetrics(fixture('8'), 16, 2);
  assert.ok(doubled[0].peakAlpha > faint[0].peakAlpha);
  assert.ok(Math.abs(doubled[0].inkArea - faint[0].inkArea) < 0.15);
});

test('solid metrics distinguish a covered hinge from an uncovered faint mark', () => {
  const fixture = (cy) => ({
    name: 'solid-context-fixture',
    directional: false,
    sizes: {
      16: {
        strokeWidth: 1.5,
        nodes: [
          ['path', { d: 'M5 5L11 11M5 11L11 5' }],
          ['circle', { cx: '8', cy, r: '0.5', fill: 'currentColor', stroke: 'none' }],
        ],
      },
    },
  });
  const [covered] = solidMetrics(fixture('8'), 16, 1);
  assert.ok(covered.peakAlpha > 0 && covered.peakAlpha < 128);
  assert.equal(covered.wholePeakAlpha, 255);
  assert.equal(covered.addedPeakAlpha, 0);
  assert.equal(covered.addedInkArea, 0);
  const [uncovered] = solidMetrics(fixture('3'), 16, 1);
  assert.ok(uncovered.peakAlpha > 0 && uncovered.peakAlpha < 128);
  assert.equal(uncovered.wholePeakAlpha, uncovered.peakAlpha);
  assert.equal(uncovered.addedPeakAlpha, uncovered.peakAlpha);
  assert.equal(uncovered.addedInkArea, uncovered.inkArea);
});

test('solid metrics measure a single-node mark without background artwork', () => {
  const fixture = {
    name: 'solid-alone-fixture',
    directional: false,
    sizes: {
      16: {
        strokeWidth: 1.5,
        nodes: [
          ['circle', { cx: '8.5', cy: '8.5', r: '0.5', fill: 'currentColor', stroke: 'none' }],
        ],
      },
    },
  };
  for (const dpr of [1, 2]) {
    const [mark] = solidMetrics(fixture, 16, dpr);
    assert.ok(mark.peakAlpha >= 128);
    assert.equal(mark.wholePeakAlpha, mark.peakAlpha);
    assert.equal(mark.addedPeakAlpha, mark.peakAlpha);
    assert.equal(mark.addedInkArea, mark.inkArea);
  }
});
