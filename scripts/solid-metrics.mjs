import { Resvg } from '@resvg/resvg-js';
import { renderIcon } from '../dist/core.js';

/** Measure isolated solid marks and their contribution to the complete drawing. */
export function solidMetrics(definition, opticalSize, dpr) {
  const master = definition.sizes[opticalSize];
  const solidNodes = master.nodes.flatMap((node, nodeIndex) => {
    const attributes = node[1];
    return attributes.fill === 'currentColor' && attributes.stroke === 'none'
      ? [{ node, nodeIndex }]
      : [];
  });
  if (solidNodes.length === 0) {
    return [];
  }
  const raster = (nodes) => {
    const drawing = {
      ...definition,
      sizes: { ...definition.sizes, [opticalSize]: { ...master, nodes } },
    };
    const svg = renderIcon(drawing, { size: opticalSize, opticalSize });
    return new Resvg(svg, {
      fitTo: { mode: 'zoom', value: dpr },
      font: { loadSystemFonts: false },
    }).render().pixels;
  };
  const fullPixels = raster(master.nodes);
  const area = (sum) => Math.round((sum / 255 / dpr ** 2) * 1000) / 1000;
  return solidNodes.map(({ node, nodeIndex }) => {
    const pixels = raster([node]);
    const remaining = master.nodes.filter((_, index) => index !== nodeIndex);
    const basePixels = remaining.length > 0 ? raster(remaining) : new Uint8Array(pixels.length);
    let peakAlpha = 0;
    let alphaSum = 0;
    let wholePeakAlpha = 0;
    let addedPeakAlpha = 0;
    let addedAlphaSum = 0;
    for (let offset = 3; offset < pixels.length; offset += 4) {
      const alpha = pixels[offset];
      peakAlpha = Math.max(peakAlpha, alpha);
      alphaSum += alpha;
      if (alpha > 0) {
        wholePeakAlpha = Math.max(wholePeakAlpha, fullPixels[offset]);
        const addedAlpha = Math.max(0, fullPixels[offset] - basePixels[offset]);
        addedPeakAlpha = Math.max(addedPeakAlpha, addedAlpha);
        addedAlphaSum += addedAlpha;
      }
    }
    return {
      nodeIndex,
      tag: node[0],
      peakAlpha,
      inkArea: area(alphaSum),
      wholePeakAlpha,
      addedPeakAlpha,
      addedInkArea: area(addedAlphaSum),
    };
  });
}
