import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { categories, readCatalogue } from './catalogue.mjs';
import { solidMetrics } from './solid-metrics.mjs';

const { values } = parseArgs({
  options: {
    category: { type: 'string', multiple: true },
    name: { type: 'string', multiple: true },
  },
});
const catalogue = await readCatalogue();
for (const category of values.category ?? []) {
  assert.ok(categories.includes(category), `Unknown category: ${category}.`);
}
for (const name of values.name ?? []) {
  assert.ok(
    catalogue.some((icon) => icon.meta.name === name),
    `Unknown icon: ${name}.`,
  );
}
const icons = catalogue.filter(
  ({ meta }) =>
    (!values.category || values.category.includes(meta.category)) &&
    (!values.name || values.name.includes(meta.name)),
);
assert.ok(icons.length > 0, 'The filters did not match any icons.');
const marks = [];
for (const { meta, definition } of icons) {
  for (const opticalSize of [16, 24]) {
    for (const dpr of [1, 2]) {
      for (const mark of solidMetrics(definition, opticalSize, dpr)) {
        marks.push({ name: meta.name, category: meta.category, opticalSize, dpr, ...mark });
      }
    }
  }
}
const reviewAlpha = 128;
const findings = marks
  .filter((mark) => mark.peakAlpha < reviewAlpha)
  .sort(
    (a, b) =>
      a.peakAlpha - b.peakAlpha ||
      a.name.localeCompare(b.name, 'en') ||
      a.opticalSize - b.opticalSize ||
      a.dpr - b.dpr ||
      a.nodeIndex - b.nodeIndex,
  );
const destination = join('artifacts', 'qa');
await mkdir(destination, { recursive: true });
const filename = values.name || values.category ? 'solid-marks-selected.json' : 'solid-marks.json';
const file = join(destination, filename);
await writeFile(
  file,
  `${JSON.stringify(
    {
      count: icons.length,
      reviewAlpha,
      interpretation:
        'Inspect faint marks in the full icon. wholePeakAlpha measures the complete drawing at each mark; addedPeakAlpha and addedInkArea measure what the mark adds.',
      findings,
      marks,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `Measured ${marks.length} solid marks across ${icons.length} icons; ${findings.length} need visual review. Report: ${file}.`,
);
