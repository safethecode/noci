import { getIconData } from './core.js';
import type { IconDefinition, IconOptions } from './core.js';

/** Browser adapter, kept separate so server-only types need no DOM library. */
export function createIcon(icon: IconDefinition, options?: IconOptions | null, ownerDocument?: Document): SVGSVGElement {
  const doc = ownerDocument ?? (typeof document !== 'undefined' ? document : undefined);
  if (!doc) throw new Error('createIcon needs a browser Document. Use renderIcon on the server.');
  const { attributes, nodes } = getIconData(icon, options);
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [name, value] of Object.entries(attributes)) svg.setAttribute(name, value);
  for (const [tag, attrs] of nodes) {
    const node = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    svg.append(node);
  }
  return svg;
}
