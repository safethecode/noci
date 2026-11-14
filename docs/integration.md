# Framework integration without separate packages

All examples use an original trusted definition from the installed package.
`getIconData` returns SVG attribute names. React needs camelCase presentation
properties; `aria-*` and `data-*` stay hyphenated. Vue and Svelte accept SVG names.

## HTML and server templates

```js
import check from 'noci-icons/icons/check';
import { renderIcon } from 'noci-icons/core';
const svg = renderIcon(check, { size: 16 });
// Insert this trusted SVG into the template's raw-HTML slot.
// Escape surrounding user content using your template engine as usual.
```

`renderIcon` escapes all option attribute values. Definitions are trusted code;
do not deserialize icon nodes from an untrusted upload or URL.

## React (including server rendering)

This small adapter lives in your app; the Noci package has no React dependency.

```jsx
import { createElement } from 'react';
import { getIconData } from 'noci-icons/core';
import check from 'noci-icons/icons/check';

const reactAttrs = (attributes) =>
  Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [
      key === 'class'
        ? 'className'
        : /^(aria|data)-/.test(key)
          ? key
          : key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
      value,
    ]),
  );

function Icon({ icon, ...options }) {
  const { attributes, nodes } = getIconData(icon, options);
  return createElement(
    'svg',
    reactAttrs(attributes),
    ...nodes.map(([tag, attrs], key) => createElement(tag, { ...reactAttrs(attrs), key })),
  );
}

export function SaveButton() {
  return (
    <button type="button">
      <Icon icon={check} size={16} /> Save
    </button>
  );
}
```

No hook, effect, `use client`, global registry or hydration-specific title ID is needed.
For TypeScript, type the adapter props as `{ icon: IconDefinition } & IconOptions`.

## Vue 3

```js
import { h } from 'vue';
import { getIconData } from 'noci-icons/core';
import check from 'noci-icons/icons/check';

const Icon = {
  props: ['icon', 'size', 'opticalSize', 'label', 'className', 'dir'],
  setup(props) {
    return () => {
      const { attributes, nodes } = getIconData(props.icon, props);
      return h(
        'svg',
        attributes,
        nodes.map(([tag, attrs]) => h(tag, attrs)),
      );
    };
  },
};
// <Icon :icon="check" :size="16" /> beside visible Save text.
```

## Svelte

```svelte
<script>
  import check from 'noci-icons/icons/check';
  import { renderIcon } from 'noci-icons/core';
</script>

<button type="button">{@html renderIcon(check, { size: 16 })} Save</button>
```

The raw-HTML slot is safe for the package's trusted definitions and escaped option
values. For more control, render the `getIconData` nodes using your app's native SVG
components. These are integration recipes; they are not independently versioned or
shipped framework components. Verify the adapter with your framework version.

## CSS and assets

Use `.noci-icon` from `noci-icons/styles.css` for inline baseline alignment, or center
with flex. Angular, Astro, Hono, server templates and native SVG-capable tools can
use the SVG assets directly. Assets do not require a JS renderer or network API.
