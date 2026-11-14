# Accessible icon use

## Decorative icons

When text already describes the meaning, omit `label`. The renderer sets `aria-hidden="true"` and `focusable="false"`.

## Informative icons

Pass a useful `label`. The renderer sets `role="img"` and `aria-label`. Empty labels are rejected.

```js
renderIcon(check, { size: 16, label: 'Completed' });
```

Describe the meaning in context, rather than repeating the icon's filename.

## Buttons

Use a native button. Put its action name on the button and keep the SVG decorative.

```html
<button type="button" aria-label="Download report">
  <!-- Decorative SVG -->
</button>
```

Expose toggle state with `aria-pressed` and disclosure state with `aria-expanded` on the control. Use text or a shape alongside color for status.

## Contrast and targets

Meaningful graphics need at least 3:1 contrast against adjacent colors. Normal text needs 4.5:1. Pointer targets need at least 24 × 24 CSS px or an applicable WCAG exception. A 16px icon can sit inside a larger button; artwork and target dimensions are separate decisions.

## SVG files

Raw SVGs and sprites are decorative by default. For informative inline SVG, set `role="img"` and an appropriate `aria-label`, and remove `aria-hidden`. External images need `alt=""` for decoration or a useful alternative for information. External images do not inherit the host document's `currentColor`.

Only directional navigation icons mirror when `dir: 'rtl'` is passed. Objects, clocks, text and checkmarks retain their direction.

## Testing

Run `npm run check` and `npm run test:browser`. Check names, roles, keyboard focus, forced colors and text resizing in the application that uses the icons. Test with a screen reader and record the browser and assistive technology used.

WCAG guidance: [Non-text content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
