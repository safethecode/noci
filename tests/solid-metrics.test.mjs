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
