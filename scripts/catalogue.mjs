import { readdir, readFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import svgpath from 'svgpath';

export const categories = [
  'foundation',
  'navigation',
  'actions',
  'status',
  'inclusion',
  'files',
  'communication',
  'editing',
  'layout',
  'security',
  'devices',
  'media',
  'people',
  'time',
  'weather',
  'finance',
  'commerce',
  'charts',
  'development',
];
const permitted = {
  path: ['d'],
  circle: ['cx', 'cy', 'r', 'fill', 'stroke'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function attributes(source) {
  const result = {};
  const pattern = /\s+([a-zA-Z][\w:-]*)="([^"<>&]*)"/gy;
  let cursor = 0;
  while (cursor < source.length) {
    pattern.lastIndex = cursor;
    const match = pattern.exec(source);
    if (!match) {
      assert(source.slice(cursor).trim() === '', `Invalid SVG attributes: ${source}`);
      break;
    }
    assert(!Object.hasOwn(result, match[1]), `Duplicate attribute: ${match[1]}`);
    result[match[1]] = match[2];
    cursor = pattern.lastIndex;
  }
  return result;
}

/** Accept only Noci's flat, self-closing SVG subset. No XML entities, refs or scripts. */
export function parseMaster(svg, size) {
  const grid = size === 16 ? 4 : 8;
  const onGrid = (value) =>
    Number.isFinite(value) && Math.abs(value * grid - Math.round(value * grid)) < 0.000001;
  const gridMessage = `Use ${1 / grid}px steps for move points and straight strokes.`;
  const document = svg.trim().match(/^<svg(\s[^>]*)>([\s\S]*)<\/svg>$/);
  assert(document, 'Expected one SVG root without XML declarations or comments.');
  const root = attributes(document[1]);
  const expected = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: String(size),
    height: String(size),
    viewBox: `0 0 ${size} ${size}`,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': size === 16 ? '1.5' : '1.75',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  };
  assert(Object.keys(root).length === Object.keys(expected).length, 'Unexpected root attribute.');
  for (const [key, value] of Object.entries(expected)) {
    assert(root[key] === value, `Expected ${key}="${value}".`);
  }
  let body = document[2].trim();
  const nodes = [];
  while (body) {
    const match = body.match(/^<([a-z]+)((?:\s+[\w:-]+="[^"<>&]*")*\s*)\/>/);
    assert(
      match && Object.hasOwn(permitted, match[1]),
      'Only approved self-closing SVG primitives are allowed.',
    );
    const tag = match[1],
      attrs = attributes(match[2]);
    assert(Object.keys(attrs).length > 0, 'Empty primitive.');
    for (const [key, value] of Object.entries(attrs)) {
      assert(permitted[tag].includes(key), `Unexpected ${tag}.${key}.`);
      if (key === 'fill') {
        assert(value === 'currentColor', 'Only currentColor fill is permitted.');
      } else if (key === 'stroke') {
        assert(value === 'none', 'Only filled dots can suppress the stroke.');
      } else if (key === 'd') {
        assert(
          /^[MmLlHhVvCcSsQqTtAaZz\d\s.,+-]+$/.test(value) && /^[Mm]/.test(value),
          'Invalid path data.',
        );
      } else if (key === 'points') {
        assert(/^[\d\s.,+-]+$/.test(value), 'Invalid point list.');
      } else {
        assert(
          /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) && Number.isFinite(Number(value)),
          `Invalid numeric ${key}.`,
        );
      }
    }
    if (tag === 'path') {
      assert(typeof attrs.d === 'string', 'Path needs d.');
      const path = svgpath(attrs.d);
      assert(!path.err, `Invalid path: ${path.err}`);
      path.abs().iterate((segment, _index, x, y) => {
        assert(segment.slice(1).every(Number.isFinite), 'Path coordinates must be finite.');
        if (['M', 'L', 'H', 'V'].includes(segment[0])) {
          assert(segment.slice(1).every(onGrid), gridMessage);
        }
        if (segment[0] === 'H') {
          assert(onGrid(y), gridMessage);
        }
        if (segment[0] === 'V') {
          assert(onGrid(x), gridMessage);
        }
      });
    }
    if (tag === 'circle') {
      assert(Number(attrs.r) > 0 && attrs.cx != null && attrs.cy != null, 'Invalid circle.');
    }
    if (tag === 'rect') {
      assert(
        Number(attrs.width) > 0 && Number(attrs.height) > 0 && attrs.x != null && attrs.y != null,
        'Invalid rect.',
      );
      assert(
        ['x', 'y', 'width', 'height'].every((key) => onGrid(Number(attrs[key]))),
        gridMessage,
      );
      assert(
        ['rx', 'ry'].every((key) => attrs[key] == null || Number(attrs[key]) >= 0),
        'Corner radii must be non-negative.',
      );
    }
    if (tag === 'line') {
      assert(
        ['x1', 'x2', 'y1', 'y2'].every((k) => attrs[k] != null),
        'Invalid line.',
      );
      assert(
        Object.values(attrs).every((value) => onGrid(Number(value))),
        gridMessage,
      );
    }
    if (tag === 'polyline' || tag === 'polygon') {
      assert(attrs.points, 'Point list is required.');
      const points = attrs.points
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      assert(
        points.length >= (tag === 'polygon' ? 6 : 4) && points.length % 2 === 0,
        'Point lists need complete coordinate pairs.',
      );
      assert(points.every(onGrid), gridMessage);
    }
    if (attrs.fill || attrs.stroke) {
      assert(
        tag === 'circle' && attrs.fill === 'currentColor' && attrs.stroke === 'none',
        'Only dots use fill.',
      );
    }
    nodes.push([tag, attrs]);
    body = body.slice(match[0].length).trim();
  }
  assert(nodes.length > 0 && nodes.length <= 6, 'Use between one and six primitives.');
  assert(Buffer.byteLength(svg) <= 1600, 'Master exceeds the 1,600-byte SVG budget.');
  return { strokeWidth: Number(root['stroke-width']), nodes };
}

export function rasterMetrics(svg, size, zoom = 8) {
  const result = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: zoom },
    font: { loadSystemFonts: false },
  }).render();
  const pixels = result.pixels,
    width = result.width,
    height = result.height;
  let minX = width,
    maxX = -1,
    minY = height,
    maxY = -1,
    mass = 0,
    xMass = 0,
    yMass = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = pixels[(y * width + x) * 4 + 3] / 255;
      mass += alpha;
      xMass += (x + 0.5) * alpha;
      yMass += (y + 0.5) * alpha;
      if (alpha > 0.03) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  assert(mass > 0 && maxX >= minX, 'Artwork is empty.');
  const round = (n) => Math.round(n * 1000) / 1000;
  return {
    bounds: [minX / zoom, minY / zoom, (maxX + 1) / zoom, (maxY + 1) / zoom],
    centroid: [round(xMass / mass / zoom), round(yMass / mass / zoom)],
    inkArea: round(mass / zoom ** 2),
    density: round(mass / (size * zoom) ** 2),
  };
}

export const exportName = (name) =>
  `${name
    .split('-')
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join('')}Icon`;

export async function readCatalogue(root = new URL('../icons/', import.meta.url)) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  const icons = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (!entry.isDirectory()) {
      continue;
    }
    assert(categories.includes(entry.name), `Unknown category: ${entry.name}.`);
    const dir = new URL(`${entry.name}/`, root);
    for (const item of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name, 'en'),
    )) {
      if (!item.isDirectory()) {
        continue;
      }
      const iconDir = new URL(`${item.name}/`, dir);
      const meta = JSON.parse(await readFile(new URL('meta.json', iconDir), 'utf8'));
      assert(
        meta.name === item.name && /^[a-z]+(?:-[a-z0-9]+)*$/.test(meta.name),
        `Invalid name: ${item.name}.`,
      );
      assert(meta.category === entry.name, `Wrong category for ${meta.name}.`);
      assert(typeof meta.directional === 'boolean', 'Explicit directional policy required.');
      assert(
        Array.isArray(meta.tags) &&
          meta.tags.length > 0 &&
          meta.tags.length <= 3 &&
          new Set(meta.tags).size === meta.tags.length &&
          meta.tags.every((x) => typeof x === 'string' && x.trim()),
        'Use 1–3 unique tags.',
      );
      for (const key of ['description', 'useCase', 'misuse']) {
        assert(typeof meta[key] === 'string' && meta[key].trim(), `${meta.name}: missing ${key}.`);
      }
      const sizes = {},
        metrics = {};
      for (const size of [16, 24]) {
        const optical = meta.optical?.[size];
        assert(
          optical && typeof optical.reason === 'string' && optical.reason.trim(),
          `${meta.name}: optical explanation required.`,
        );
        assert(
          Array.isArray(optical.offset) &&
            optical.offset.length === 2 &&
            optical.offset.every(
              (n) => Number.isFinite(n) && Math.abs(n) <= (size === 16 ? 0.5 : 0.75),
            ),
          'Optical offset exceeds the allowed range.',
        );
        const svg = await readFile(new URL(`${size}.svg`, iconDir), 'utf8');
        try {
          sizes[size] = parseMaster(svg, size);
          metrics[size] = rasterMetrics(svg, size);
          const inset = size === 16 ? 2 : 3,
            [left, top, right, bottom] = metrics[size].bounds;
          assert(
            left >= inset - 0.125 &&
              top >= inset - 0.125 &&
              right <= size - inset + 0.125 &&
              bottom <= size - inset + 0.125,
            'Painted artwork violates the safe inset.',
          );
        } catch (error) {
          throw new Error(`${meta.name}/${size}: ${error.message}`, { cause: error });
        }
      }
      assert(
        JSON.stringify(sizes[16].nodes) !== JSON.stringify(sizes[24].nodes),
        'Masters must be independently constructed.',
      );
      icons.push({
        meta,
        definition: { name: meta.name, directional: meta.directional, sizes },
        metrics,
        exportName: exportName(meta.name),
      });
    }
  }
  const names = icons.map((x) => x.meta.name);
  assert(new Set(names).size === names.length, 'Duplicate canonical names across categories.');
  return icons.sort((a, b) => a.meta.name.localeCompare(b.meta.name, 'en'));
}
