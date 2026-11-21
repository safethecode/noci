import assert from 'node:assert/strict';
import test from 'node:test';
import { Resvg } from '@resvg/resvg-js';
import { renderIcon } from 'noci-icons/core';
import svgpath from 'svgpath';
import { readCatalogue } from '../scripts/catalogue.mjs';

const catalogue = await readCatalogue();
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1]];

function closedSegments(data) {
  const path = svgpath(data).abs().unshort().unarc();
  assert.equal(path.segments.at(-1)[0], 'Z');
  const start = path.segments[0].slice(1);
  let position = start;
  const segments = [];
  for (const [command, ...values] of path.segments.slice(1)) {
    const end = command === 'Z' ? start : values.slice(-2);
    const controls = command === 'C' ? [values.slice(0, 2), values.slice(2, 4)] : [];
    if (command === 'Q') {
      controls.push(values.slice(0, 2));
    }
    assert.ok(['C', 'Q', 'L', 'Z'].includes(command));
    const points = [position, ...controls, end];
    const entry = points.slice(1).map((point) => subtract(point, position));
    const exit = points
      .slice(0, -1)
      .reverse()
      .map((point) => subtract(end, point));
    const nonzero = (vector) => Math.hypot(...vector) > 1e-8;
    if (entry.some(nonzero)) {
      segments.push({ end, entry: entry.find(nonzero), exit: exit.find(nonzero) });
    }
    position = end;
  }
  return segments;
}

function assertSmooth(segments, description, symmetryAxis) {
  for (let index = 0; index < segments.length; index++) {
    const current = segments[index];
    if (symmetryAxis !== undefined && Math.abs(current.end[0] - symmetryAxis) < 1e-6) {
      continue;
    }
    const incoming = current.exit;
    const outgoing = segments[(index + 1) % segments.length].entry;
    const dot = incoming[0] * outgoing[0] + incoming[1] * outgoing[1];
    const cross = incoming[0] * outgoing[1] - incoming[1] * outgoing[0];
    assert.ok(
      dot > 0 && Math.abs(cross) / (Math.hypot(...incoming) * Math.hypot(...outgoing)) < 0.01,
      `${description}: unexpected corner at ${current.end.join(', ')}.`,
    );
  }
}

test('embedded heart shoulders join smoothly on both sides', () => {
  for (const name of [
    'calendar-heart',
    'folder-heart',
    'mail-heart',
    'message-circle-heart',
    'message-square-heart',
  ]) {
    const { definition } = catalogue.find((icon) => icon.meta.name === name);
    for (const size of [16, 24]) {
      const [, { d }] = definition.sizes[size].nodes.at(-1);
      assertSmooth(closedSegments(d), `${name}/${size}`, size / 2);
    }
  }
});

test('folder arrowheads have tangent rounded corners in every direction', () => {
  for (const direction of ['up', 'down', 'left', 'right']) {
    const name = `folder-arrow-${direction}`;
    const { definition } = catalogue.find((icon) => icon.meta.name === name);
    for (const size of [16, 24]) {
      const [, { d }] = definition.sizes[size].nodes.at(-1);
      assertSmooth(closedSegments(d), `${name}/${size}`);
    }
  }
});

test('rounded avocado and bean outlines have continuous tangents', () => {
  for (const name of ['avocado', 'bean']) {
    const { definition } = catalogue.find((icon) => icon.meta.name === name);
    for (const size of [16, 24]) {
      const [, { d }] = definition.sizes[size].nodes[0];
      assertSmooth(closedSegments(d), `${name}/${size}`);
    }
  }
});

test('bubble symbols leave clear space inside their frames', () => {
  const zoom = 32;
  for (const { meta, definition } of catalogue.filter((icon) =>
    icon.meta.name.startsWith('message-circle-'),
  )) {
    for (const size of [16, 24]) {
      const boundaries = [false, true].map((feature) => {
        const isolated = {
          ...definition,
          sizes: Object.fromEntries(
            Object.entries(definition.sizes).map(([masterSize, master]) => [
              masterSize,
              { ...master, nodes: feature ? master.nodes.slice(1) : master.nodes.slice(0, 1) },
            ]),
          ),
        };
        const { pixels, width, height } = new Resvg(renderIcon(isolated, { size }), {
          fitTo: { mode: 'zoom', value: zoom },
        }).render();
        const painted = (x, y) => pixels[(y * width + x) * 4 + 3] >= 128;
        const boundary = [];
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            if (
              painted(x, y) &&
              (!painted(x - 1, y) || !painted(x + 1, y) || !painted(x, y - 1) || !painted(x, y + 1))
            ) {
              boundary.push([x, y]);
            }
          }
        }
        assert.ok(boundary.length > 0, `${meta.name}/${size}: empty artwork.`);
        return boundary;
      });
      let squaredGap = Number.POSITIVE_INFINITY;
      for (const [x, y] of boundaries[0]) {
        for (const [otherX, otherY] of boundaries[1]) {
          const dx = x - otherX;
          const dy = y - otherY;
          squaredGap = Math.min(squaredGap, dx * dx + dy * dy);
        }
      }
      const gap = (Math.sqrt(squaredGap) - 1) / zoom;
      assert.ok(
        gap >= (size === 16 ? 1 : 1.5) - 2 / zoom,
        `${meta.name}/${size}: the symbol is too close to the frame.`,
      );
    }
  }
});
