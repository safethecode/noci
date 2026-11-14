import assert from 'node:assert/strict';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { Resvg } from '@resvg/resvg-js';
import { renderIcon } from '../dist/core.js';
import { categories, readCatalogue } from './catalogue.mjs';

const { values } = parseArgs({
  options: {
    category: { type: 'string', multiple: true },
    name: { type: 'string', multiple: true },
    theme: { type: 'string', multiple: true },
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
const themes = [...new Set(values.theme ?? ['light', 'dark'])];
assert.ok(
  themes.every((theme) => ['light', 'dark'].includes(theme)),
  'Use light or dark.',
);
const icons = catalogue.filter(
  ({ meta }) =>
    (!values.category || values.category.includes(meta.category)) &&
    (!values.name || values.name.includes(meta.name)),
);
assert.ok(icons.length > 0, 'The filters did not match any icons.');
const selection = values.category || values.name || values.theme ? 'selected' : 'all';
const destination = join('artifacts', 'qa', selection);
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
const xml = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char],
  );
const pageSize = 24;
const pages = Math.ceil(icons.length / pageSize);
const fontCandidates = {
  sans: [
    ['Arial', '/System/Library/Fonts/Supplemental/Arial.ttf'],
    ['DejaVu Sans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'],
    ['Liberation Sans', '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'],
    ['Arial', 'C:/Windows/Fonts/arial.ttf'],
  ],
  serif: [
    ['Georgia', '/System/Library/Fonts/Supplemental/Georgia.ttf'],
    ['DejaVu Serif', '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'],
    ['Liberation Serif', '/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf'],
    ['Georgia', 'C:/Windows/Fonts/georgia.ttf'],
  ],
  mono: [
    ['Menlo', '/System/Library/Fonts/Menlo.ttc'],
    ['DejaVu Sans Mono', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'],
    ['Liberation Mono', '/usr/share/fonts/truetype/liberation2/LiberationMono-Regular.ttf'],
    ['Consolas', 'C:/Windows/Fonts/consola.ttf'],
  ],
  korean: [
    ['Apple SD Gothic Neo', '/System/Library/Fonts/AppleSDGothicNeo.ttc'],
    ['Noto Sans CJK KR', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'],
    ['Malgun Gothic', 'C:/Windows/Fonts/malgun.ttf'],
  ],
};
const fonts = {};
for (const [role, candidates] of Object.entries(fontCandidates)) {
  for (const [family, file] of candidates) {
    try {
      await access(file);
      fonts[role] = { family, file };
      break;
    } catch {
      // Try the next installed family.
    }
  }
}
const fontOptions = {
  loadSystemFonts: !fonts.sans || !fonts.serif || !fonts.mono || !fonts.korean,
  fontFiles: Object.values(fonts).map((font) => font.file),
  defaultFontFamily: fonts.sans?.family ?? 'Arial',
  sansSerifFamily: fonts.sans?.family ?? 'Arial',
  serifFamily: fonts.serif?.family ?? 'Times New Roman',
  monospaceFamily: fonts.mono?.family ?? 'Courier New',
};
const samples = [
  { family: fonts.sans?.family ?? 'sans-serif', size: 14, text: 'Search', korean: '검색' },
  { family: fonts.serif?.family ?? 'serif', size: 16, text: 'Save', korean: '저장' },
  { family: fonts.mono?.family ?? 'monospace', size: 14, text: 'path/file' },
];
function placedIcon(definition, size, x, y) {
  return renderIcon(definition, { size }).replace('<svg ', `<svg x="${x}" y="${y}" `);
}
for (const theme of themes) {
  const ink = theme === 'light' ? '#1f2328' : '#f0f6fc';
  const bg = theme === 'light' ? '#ffffff' : '#0d1117';
  const muted = theme === 'light' ? '#59636e' : '#b1bac4';
  const border = theme === 'light' ? '#d1d9e0' : '#3d444d';
  for (let page = 0; page < pages; page++) {
    const batch = icons.slice(page * pageSize, (page + 1) * pageSize);
    const columns = 3,
      cellWidth = 340,
      rowHeight = 184;
    const width = columns * cellWidth + 40;
    const height = Math.ceil(batch.length / columns) * rowHeight + 100;
    const cells = batch
      .map(({ definition, meta }, i) => {
        const x = 20 + (i % columns) * cellWidth;
        const y = 80 + Math.floor(i / columns) * rowHeight;
        const shapes = [16, 24, 32, 48]
          .map((size, j) => {
            const cx = x + 30 + j * 70,
              cy = y + 35;
            return (
              `<rect x="${cx - 26}" y="${cy - 26}" width="52" height="52" rx="4" fill="none" stroke="${border}" stroke-width=".5"/>` +
              placedIcon(definition, size, cx - size / 2, cy - size / 2)
            );
          })
          .join('');
        const type = samples
          .map((sample, j) => {
            const top = y + 99 + j * 24;
            return (
              placedIcon(definition, 16, x + 4, top) +
              `<text x="${x + 28}" y="${top + 13}" fill="${ink}" font-family="${sample.family}" font-size="${sample.size}">${sample.text}</text>` +
              (sample.korean
                ? placedIcon(definition, 16, x + 144, top) +
                  `<text x="${x + 168}" y="${top + 13}" fill="${ink}" font-family="${fonts.korean?.family ?? 'sans-serif'}" font-size="${sample.size}">${sample.korean}</text>`
                : '')
            );
          })
          .join('');
        return `${shapes}<text x="${x + 4}" y="${y + 83}" font-size="12" fill="${muted}">${xml(meta.name)} · ${xml(meta.category)}</text>${type}`;
      })
      .join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="color:${ink};font-family:Arial,sans-serif"><rect width="100%" height="100%" fill="${bg}"/><text x="24" y="34" fill="${ink}" font-size="20" font-weight="600">Noci · ${icons.length} icons · ${page + 1}/${pages}</text><text x="24" y="57" fill="${muted}" font-size="12">16 / 24 / 32 / 48 CSS px · inspect at 100% · 14px sans / 16px serif / 14px mono</text>${cells}</svg>`;
    const base = join(destination, `${theme}-${String(page + 1).padStart(3, '0')}`);
    await writeFile(`${base}.svg`, svg);
    for (const dpr of [1, 2]) {
      await writeFile(
        `${base}@${dpr}x.png`,
        new Resvg(svg, { fitTo: { mode: 'zoom', value: dpr }, font: fontOptions }).render().asPng(),
      );
    }
  }
}
await writeFile(
  join(destination, 'metrics.json'),
  `${JSON.stringify(
    {
      count: icons.length,
      pages,
      pageSize,
      themes,
      fonts: Object.fromEntries(Object.entries(fonts).map(([role, font]) => [role, font.family])),
      interpretation:
        'Bounds, centroid and density help inspect geometry; perceived balance and recognition require visual review.',
      icons: icons.map((icon) => ({
        name: icon.meta.name,
        metrics: icon.metrics,
        optical: icon.meta.optical,
      })),
    },
    null,
    2,
  )}\n`,
);
console.log(`Created ${pages * themes.length} sheets for ${icons.length} icons in ${destination}.`);
