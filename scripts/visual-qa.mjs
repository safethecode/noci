import { mkdir, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import { renderIcon } from '../dist/core.js';
import { readCatalogue } from './catalogue.mjs';

const icons = await readCatalogue();
await mkdir('artifacts/qa', { recursive: true });
const xml = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char],
  );
for (const theme of ['light', 'dark']) {
  const ink = theme === 'light' ? '#1f2328' : '#f0f6fc';
  const bg = theme === 'light' ? '#ffffff' : '#0d1117';
  const muted = theme === 'light' ? '#59636e' : '#b1bac4';
  const border = theme === 'light' ? '#d1d9e0' : '#3d444d';
  const columns = 3,
    cellWidth = 340,
    rowHeight = 100;
  const rows = Math.ceil(icons.length / columns),
    width = columns * cellWidth + 40,
    height = rows * rowHeight + 100;
  const cells = icons
    .map(({ definition, meta }, i) => {
      const x = 20 + (i % columns) * cellWidth,
        y = 80 + Math.floor(i / columns) * rowHeight;
      const shapes = [16, 24, 32, 48]
        .map((size, j) => {
          const cx = x + 30 + j * 70,
            cy = y + 35;
          return (
            `<rect x="${cx - 26}" y="${cy - 26}" width="52" height="52" rx="4" fill="none" stroke="${border}" stroke-width=".5"/>` +
            renderIcon(definition, { size }).replace(
              '<svg ',
              `<svg x="${cx - size / 2}" y="${cy - size / 2}" `,
            )
          );
        })
        .join('');
      return `${shapes}<text x="${x + 4}" y="${y + 83}" font-size="12" fill="${muted}">${xml(meta.name)} · ${xml(meta.category)}</text>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="color:${ink};font-family:Arial,sans-serif"><rect width="100%" height="100%" fill="${bg}"/><text x="24" y="34" fill="${ink}" font-size="20" font-weight="600">Noci · icon size check · ${icons.length} icons</text><text x="24" y="57" fill="${muted}" font-size="12">16 / 24 / 32 / 48 CSS px · inspect at 100% · 16 and 24 masters · 48 derived</text>${cells}</svg>`;
  await writeFile(`artifacts/qa/${theme}.svg`, svg);
  for (const dpr of [1, 2]) {
    await writeFile(
      `artifacts/qa/${theme}@${dpr}x.png`,
      new Resvg(svg, { fitTo: { mode: 'zoom', value: dpr } }).render().asPng(),
    );
  }
}
const report = {
  manualAssistiveTechnology: 'not verified',
  interpretation:
    'Bounds, centroid and density diagnose geometry. They cannot establish perceived balance or recognition.',
  icons: icons.map((x) => ({ name: x.meta.name, metrics: x.metrics, optical: x.meta.optical })),
};
await writeFile('artifacts/qa/metrics.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `Created light/dark proofs at DPR 1/2 and metrics for ${icons.length} icons. Output stays in ignored artifacts/qa/.`,
);
