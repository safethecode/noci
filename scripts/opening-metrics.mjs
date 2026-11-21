import { Resvg } from '@resvg/resvg-js';
import { renderIcon } from '../dist/core.js';

const zoom = 32;

function squaredDistances(values) {
  const length = values.length;
  const sites = new Int32Array(length);
  const boundaries = new Float64Array(length + 1);
  const result = new Float64Array(length);
  let last = 0;
  boundaries[0] = Number.NEGATIVE_INFINITY;
  boundaries[1] = Number.POSITIVE_INFINITY;
  for (let position = 1; position < length; position++) {
    let intersection;
    do {
      const previous = sites[last];
      intersection =
        (values[position] + position ** 2 - values[previous] - previous ** 2) /
        (2 * (position - previous));
      if (intersection <= boundaries[last]) {
        last--;
      } else {
        break;
      }
    } while (last >= 0);
    last++;
    sites[last] = position;
    boundaries[last] = intersection;
    boundaries[last + 1] = Number.POSITIVE_INFINITY;
  }
  last = 0;
  for (let position = 0; position < length; position++) {
    while (boundaries[last + 1] < position) {
      last++;
    }
    result[position] = (position - sites[last]) ** 2 + values[sites[last]];
  }
  return result;
}

/** Painted edge-to-edge clearance between selected nodes, sampled at 32 points per unit. */
export function markClearance(definition, opticalSize, boundaryNodes, markNodes) {
  const master = definition.sizes[opticalSize];
  const selections = [boundaryNodes, markNodes].map((indices) => {
    if (
      !Array.isArray(indices) ||
      indices.length === 0 ||
      !Array.from(indices).every(
        (index) => Number.isInteger(index) && index >= 0 && index < master.nodes.length,
      )
    ) {
      throw new Error('Clearance measurements require valid, nonempty node selections.');
    }
    const isolated = {
      ...definition,
      sizes: {
        [opticalSize]: { ...master, nodes: indices.map((index) => master.nodes[index]) },
      },
    };
    const svg = renderIcon(isolated, { size: opticalSize, opticalSize });
    const { pixels, width, height } = new Resvg(svg, {
      fitTo: { mode: 'zoom', value: zoom },
      font: { loadSystemFonts: false },
    }).render();
    const mask = new Uint8Array(width * height);
    for (let index = 0; index < mask.length; index++) {
      mask[index] = pixels[index * 4 + 3] >= 128 ? 1 : 0;
    }
    if (!mask.some(Boolean)) {
      throw new Error('Clearance measurements require painted artwork in both selections.');
    }
    return { mask, width, height };
  });
  const [{ mask: boundary, width, height }, { mask: marks }] = selections;
  const horizontal = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = Float64Array.from({ length: width }, (_, x) =>
      boundary[y * width + x] ? 0 : 1e12,
    );
    horizontal.set(squaredDistances(row), y * width);
  }
  let nearest = Number.POSITIVE_INFINITY;
  for (let x = 0; x < width; x++) {
    const column = Float64Array.from({ length: height }, (_, y) => horizontal[y * width + x]);
    const distances = squaredDistances(column);
    for (let y = 0; y < height; y++) {
      if (marks[y * width + x]) {
        nearest = Math.min(nearest, distances[y]);
      }
    }
  }
  // Distances are between sample centers; subtract one sample for the two painted edges.
  return Math.max(0, (Math.sqrt(nearest) - 1) / zoom);
}

/** Approximate enclosed white openings in the complete painted icon at 32 samples per unit. */
export function openingMetrics(definition, opticalSize) {
  const svg = renderIcon(definition, { size: opticalSize, opticalSize });
  const { pixels, width, height } = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: zoom },
    font: { loadSystemFonts: false },
  }).render();
  const count = width * height;
  const painted = new Uint8Array(count);
  const seen = new Uint8Array(count);
  const queue = new Int32Array(count);
  const horizontal = new Float64Array(count);
  const distances = new Float64Array(count);
  for (let index = 0; index < count; index++) {
    painted[index] = pixels[index * 4 + 3] >= 128 ? 1 : 0;
  }
  for (let y = 0; y < height; y++) {
    const row = Float64Array.from({ length: width }, (_, x) => (painted[y * width + x] ? 0 : 1e12));
    horizontal.set(squaredDistances(row), y * width);
  }
  for (let x = 0; x < width; x++) {
    const column = Float64Array.from({ length: height }, (_, y) => horizontal[y * width + x]);
    const result = squaredDistances(column);
    for (let y = 0; y < height; y++) {
      distances[y * width + x] = result[y];
    }
  }
  const openings = [];
  const round = (value) => Math.round(value * 1000) / 1000;
  for (let start = 0; start < count; start++) {
    if (painted[start] || seen[start]) {
      continue;
    }
    let read = 0;
    let written = 1;
    let touchesEdge = false;
    let widest = start;
    queue[0] = start;
    seen[start] = 1;
    while (read < written) {
      const index = queue[read++];
      const x = index % width;
      const y = Math.floor(index / width);
      touchesEdge ||= x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (distances[index] > distances[widest]) {
        widest = index;
      }
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && !painted[neighbor] && !seen[neighbor]) {
          seen[neighbor] = 1;
          queue[written++] = neighbor;
        }
      }
    }
    if (!touchesEdge) {
      openings.push({
        area: round(written / zoom ** 2),
        diameter: round((2 * Math.sqrt(distances[widest])) / zoom),
        center: [
          round(((widest % width) + 0.5) / zoom),
          round((Math.floor(widest / width) + 0.5) / zoom),
        ],
      });
    }
  }
  return openings.sort((a, b) => a.diameter - b.diameter || a.area - b.area);
}
