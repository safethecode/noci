# Architecture decision: one portable package

Status: accepted for the alpha. Date: 2026-11-14.

## Format and runtime

Original, size-specific SVG masters and JSON metadata are the source of truth. A
deterministic Node build emits SVG at 16/24/48, same-origin SVG sprites, typed icon
definitions and a tiny optional string/DOM renderer. TypeScript checks the renderer;
esbuild compiles ESM/CJS. Neither is shipped as a runtime dependency.

The package has **zero runtime dependencies**. No React/Vue/Svelte adapters, icon
font, custom-element registration, hydration, network lookup or whole-catalogue
runtime registry is required. Standard SVG works in any SVG-capable web framework,
server template and design tool. Native UI toolkits may need their own SVG loader;
“portable” does not mean SVG is a native control on every platform.

Each icon has a direct entry (`noci-icons/icons/search`). The root is a side-effect
free convenience barrel; direct entries avoid loading or transforming that barrel
in development. Catalogue metadata is a separate opt-in JSON export and is never
imported by the renderer. ESM and CJS both use explicit relative extensions. Each
icon exports exactly its two masters, not the whole set. Consumers needing no JS
can copy or reference a raw SVG or a sprite symbol.

No automatic DOM scan, MutationObserver or global configuration is installed.
`createIcon` uses the caller's `Document` (or the browser default) at invocation time,
so importing the package works without DOM globals. `renderIcon` is deterministic
and server-safe. DOM integration does not replace framework-managed nodes.

## Budgets and boundaries

- Individual plain SVG: ≤1,600 uncompressed bytes.
- One direct icon plus renderer: ≤2,500 gzip bytes after bundling.
- Two icons plus renderer: ≤3,500 gzip bytes; both entry styles must tree-shake.
- Zero production dependencies and no browser-global access at import time.

`npm run size` measures actual exports with esbuild and gzip; it does not quote the
entire tarball as a runtime payload. Both optical masters are carried by a JS icon;
use a raw SVG when only one master is needed. Sprites contain the complete set and
are opt-in: do not fetch an entire sprite to display a single icon.

## Why this stack

SVG preserves vector sharpness, currentColor and semantic markup without icon-font
loading or fallback glyphs. The same assets work in all web renderers, so maintaining
several framework-specific implementations would add cost without improving the
first release. React, Vue and Svelte examples demonstrate the data/DOM boundary.
All tooling is development-only. The package builds directly from the SVG sources.

48px is deliberately a derived 24px export. Separate 16px artwork avoids blindly
shrinking detail, while a third optical master would need evidence of a visual gap.
No framework or hosted backend is needed to ship an icon package. Vercel hosting is
optional for a future documentation site, not a library dependency.
