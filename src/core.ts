/** Original, trusted icon data. Do not load definitions from untrusted input. */
export type IconNode = readonly [
  tag: 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'polygon',
  attributes: Readonly<Record<string, string>>
];

export type OpticalSize = 16 | 24;

export interface IconMaster {
  readonly strokeWidth: number;
  readonly nodes: readonly IconNode[];
}

export interface IconDefinition {
  readonly name: string;
  readonly directional: boolean;
  readonly sizes: Readonly<Record<OpticalSize, IconMaster>>;
}

export interface IconOptions {
  /** Positive pixels or a positive CSS length (px, em, rem, %). Default: 24. */
  size?: number | string;
  /** Defaults to 16 at numeric sizes ≤20, 24 above; CSS lengths default to 16. */
  opticalSize?: OpticalSize;
  /** Omit for decoration. A provided string must have a non-empty accessible name. */
  label?: string | null;
  className?: string;
  /** Only directional navigation symbols are mirrored. Default: ltr. */
  dir?: 'ltr' | 'rtl';
}

export interface IconData {
  readonly attributes: Readonly<Record<string, string>>;
  readonly nodes: readonly IconNode[];
}

const own = <K extends keyof IconOptions>(options: IconOptions, key: K): IconOptions[K] | undefined =>
  Object.hasOwn(options, key) ? options[key] : undefined;

/** SVG attributes and nodes, for a framework's own native element renderer. */
export function getIconData(icon: IconDefinition, options: IconOptions | null = {}): IconData {
  const opts = options ?? {};
  const size = own(opts, 'size') ?? 24;
  if (typeof size === 'number') {
    if (!Number.isFinite(size) || size <= 0) throw new RangeError('Icon size must be positive and finite.');
  } else if (typeof size !== 'string' || !/^(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|%)$/.test(size) || parseFloat(size) <= 0) {
    throw new TypeError('Icon size must be positive pixels or a CSS length (px, em, rem, %).');
  }
  const opticalSize = own(opts, 'opticalSize') ?? (typeof size === 'number' ? (size <= 20 ? 16 : 24) : 16);
  if (opticalSize !== 16 && opticalSize !== 24) throw new RangeError('Optical size must be 16 or 24.');
  const label = own(opts, 'label');
  if (label != null && (typeof label !== 'string' || label.trim() === '')) {
    throw new TypeError('An informative icon needs a non-empty label. Omit label for decoration.');
  }
  const className = own(opts, 'className');
  if (className != null && typeof className !== 'string') throw new TypeError('className must be a string.');
  const direction = own(opts, 'dir') ?? 'ltr';
  if (direction !== 'ltr' && direction !== 'rtl') throw new TypeError('dir must be ltr or rtl.');
  const master = icon.sizes[opticalSize];
  const attributes: Record<string, string> = {
    xmlns: 'http://www.w3.org/2000/svg', width: String(size), height: String(size),
    viewBox: `0 0 ${opticalSize} ${opticalSize}`, fill: 'none', stroke: 'currentColor',
    'stroke-width': String(master.strokeWidth), 'stroke-linecap': 'round',
    'stroke-linejoin': 'round', focusable: 'false',
    class: className ? `noci-icon ${className}` : 'noci-icon'
  };
  if (label == null) attributes['aria-hidden'] = 'true';
  else { attributes.role = 'img'; attributes['aria-label'] = label; }
  // Transform the artwork rather than the outer box; layout and focus do not change.
  const nodes: readonly IconNode[] = direction === 'rtl' && icon.directional
    ? master.nodes.map(([tag, attrs]) => [tag, { ...attrs, transform: `translate(${opticalSize} 0) scale(-1 1)` }] as const)
    : master.nodes;
  return { attributes, nodes };
}

const escapeAttribute = (value: string): string => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]!);

const serializeAttributes = (attributes: Readonly<Record<string, string>>): string =>
  Object.entries(attributes).map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`).join('');

/** Deterministic SVG string. Safe to call on a server with no DOM globals. */
export function renderIcon(icon: IconDefinition, options?: IconOptions | null): string {
  const { attributes, nodes } = getIconData(icon, options);
  return `<svg${serializeAttributes(attributes)}>${nodes.map(([tag, attrs]) =>
    `<${tag}${serializeAttributes(attrs)}/>`).join('')}</svg>`;
}

