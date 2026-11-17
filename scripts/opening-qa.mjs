import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { categories, readCatalogue } from './catalogue.mjs';
import { openingMetrics } from './opening-metrics.mjs';

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
const openings = [];
for (const { meta, definition } of icons) {
  for (const opticalSize of [16, 24]) {
    for (const opening of openingMetrics(definition, opticalSize)) {
      openings.push({ name: meta.name, category: meta.category, opticalSize, ...opening });
    }
  }
}
// A 32× mask can differ from the curve boundary by up to two samples.
const tolerance = 2 / 32;
const findings = openings
  .filter((opening) => opening.diameter < (opening.opticalSize === 16 ? 1 : 1.5) - tolerance)
  .sort((a, b) => a.diameter - b.diameter || a.name.localeCompare(b.name, 'en'));
const destination = join('artifacts', 'qa');
await mkdir(destination, { recursive: true });
const filename = values.name || values.category ? 'openings-selected.json' : 'openings.json';
const file = join(destination, filename);
await writeFile(
  file,
  `${JSON.stringify(
    {
      count: icons.length,
      samplesPerUnit: 32,
      alphaThreshold: 128,
      tolerance,
      interpretation:
        'Inspect small enclosed openings and stroke junctions at native size and enlarged. Open gaps and missing openings need separate visual review.',
      findings,
      openings,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `Measured ${openings.length} enclosed openings across ${icons.length} icons; ${findings.length} need visual review. Report: ${file}.`,
);
