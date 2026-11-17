import { Resvg } from '@resvg/resvg-js';
import { renderIcon } from '../dist/core.js';

/** Measure each solid mark alone so other artwork cannot hide a faint or empty mark. */
export function solidMetrics(definition, opticalSize, dpr) {
  const master = definition.sizes[opticalSize];
  return master.nodes.flatMap((node, nodeIndex) => {
    const [tag, attributes] = node;
    if (attributes.fill !== 'currentColor' || attributes.stroke !== 'none') {
      return [];
    }
    const isolated = {
      ...definition,
      sizes: { ...definition.sizes, [opticalSize]: { ...master, nodes: [node] } },
    };
    const svg = renderIcon(isolated, { size: opticalSize, opticalSize });
    const { pixels } = new Resvg(svg, {
      fitTo: { mode: 'zoom', value: dpr },
      font: { loadSystemFonts: false },
    }).render();
    let peakAlpha = 0;
    let alphaSum = 0;
    for (let offset = 3; offset < pixels.length; offset += 4) {
      peakAlpha = Math.max(peakAlpha, pixels[offset]);
      alphaSum += pixels[offset];
    }
    return [
      { nodeIndex, tag, peakAlpha, inkArea: Math.round((alphaSum / 255 / dpr ** 2) * 1000) / 1000 },
    ];
  });
}
