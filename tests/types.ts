import { createIcon, getIconData, renderIcon } from 'noci-icons';
import type { IconDefinition, IconOptions } from 'noci-icons/core';

declare const icon: IconDefinition;
const options: IconOptions = { size: '1em', opticalSize: 16, label: '검색', dir: 'rtl' };
const svg: string = renderIcon(icon, options);
const element: SVGSVGElement = createIcon(icon, null, document);
const nodes = getIconData(icon).nodes;
// @ts-expect-error Unsupported optical masters must fail type checking.
renderIcon(icon, { opticalSize: 48 });
// @ts-expect-error There is no style override that silently changes stroke weight.
renderIcon(icon, { strokeWidth: 4 });
void [svg, element, nodes];
