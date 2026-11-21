# Icon design guidelines

An icon should explain an action quietly and sit beside text without an adjustment.

## Optical sizes

| Property                             | Text master | Interface master | Large export          |
| ------------------------------------ | ----------- | ---------------- | --------------------- |
| Artboard / viewBox                   | 16 × 16     | 24 × 24          | 48 × 48               |
| Construction                         | Hand drawn  | Hand drawn       | Exact 2× export of 24 |
| Stroke                               | 1.5         | 1.75             | 3.5                   |
| Minimum painted inset                | 2           | 3                | 6                     |
| Drawing area                         | 12 × 12     | 18 × 18          | 36 × 36               |
| Typical corner radius                | 1           | 1.5              | 3                     |
| Clear gap between unrelated marks    | ≥1          | ≥1.5             | ≥3                    |
| Maximum optical translation per axis | 0.5         | 0.75             | 1.5                   |

These values define the icon style. WCAG requirements are covered in the accessibility guide.
Every icon uses the same square drawing frame: 12 × 12 within 16 × 16, 18 × 18 within 24 × 24, and 36 × 36 within 48 × 48. Keep natural symbol proportions within that frame.

24 is the UI default. Use the 16 master at 12–20 CSS px, the 24 master above 20.
For a CSS size such as `1em`, choose the master explicitly when context is known;
the default is 16. A 48 export is a convenience, not a third hand-tuned master.
Do not promise the same apparent weight at every arbitrary scale.

Align path move points and straight strokes to a quarter-unit grid at 16px and an eighth-unit grid at 24px. A 1.5 stroke naturally lands on
half or quarter coordinates; forcing every centerline to an integer makes it blurrier.
Curve controls and endpoints may use other coordinates. Keep a horizontal or vertical stroke's constant axis on the grid even when it follows a curve. Pixel alignment is subordinate to recognizability.
Use round caps and joins, restrained rounded corners, no gradients, shadows or baked
colors. Prefer one clear silhouette and no more than six simple primitives. Keep the
main silhouette outlined. Dots and small, simple marks such as playback triangles may
be solid when an outline would close the interior at 16px. A solid mark uses a circle
or one explicitly closed path, `fill="currentColor"` and `stroke="none"`. It follows
the same spacing and optical review rules as an outlined mark. All paint follows
`currentColor`.

A solid region may carry the symbol's meaning, such as the dark half of a contrast
control. Keep its outer silhouette outlined and geometrically centered. The solid
region follows that silhouette; do not shift the icon toward its ink centroid.
Use one simple closed path per region and review its weight beside outlined icons.

## Center and weight

1. Start from the center of the artboard, not the center of the SVG bounding box.
2. Symmetric artwork remains geometrically centered on its symmetry axes.
3. For asymmetric shapes, compare with circle, square, check and search in a fixed
   square button, and in a text row. Judge the visual mass, open space and direction.
4. Record intentional offsets in the icon's metadata with a concrete reason. Apply
   the translation once in the master coordinates. Consumers must not add offsets.
5. Inspect alpha-weighted centroid, painted bounds and density in `npm run qa`.
   Centroid is a diagnostic, not proof of perceived center: a folder tab and an arrow
   head can pull it away from the apparent center. Document exceptions; never move
   everything blindly to its mass centroid.
6. Inspect at actual 16, 24, 32 and 48px on both light and dark backgrounds at DPR 1
   and 2. Enlarging an icon cannot establish small-size legibility.
7. Run `npm run qa:marks` to find faint or empty solid marks. Inspect flagged marks
   in the complete icon and beside text at DPR 1 and 2.
   A connected stroke may make the full feature clear even when the isolated mark is faint.
   Check what the mark adds before changing it.
8. Run `npm run qa:openings` to find cramped enclosed spaces, including wedges
   formed by intersecting strokes. Check open gaps and missing counters visually.
   Check these spaces at native size: a geometric gap can still disappear between pixels.
9. Enlarge connected strokes to inspect both painted edges. A segment that joins
   a contour must meet its ink without a cap extending beyond the silhouette or
   into an intended white opening. Check the full cap at both ends and confirm
   the connection at native size.

Inspect the proportions of small symbols as well as their spacing. An arrow needs
a visible straight shaft behind its head at native size.

Use repeatable keylines,
consistent weight and visual inspection.
Review each icon before merging it.

## Type pairing

The reference environment is a system sans UI at 14/20 and 16/24; additionally inspect
Arial, system serif and monospace at 14, 16 and 20px. Test Korean labels as well as
Latin labels: 저장, 검색, 접근성, 다운로드. A font's cap height and x-height vary, so
no universal baseline offset can be exact for every font.

Use `inline-flex; align-items:center; gap:0.375em` in controls. For running text,
`.noci-icon` starts at `vertical-align:-0.125em`; `.noci-icon--text` sets a 1em box.
Choose the 16 master for body text. Match normal/medium text; do not compensate for
bold type by arbitrarily changing stroke width. Any future weight is a complete,
separately reviewed family. Icons never change the parent's line-height.

## Meaning, naming and direction

Use concrete singular kebab-case names. A name identifies the same glyph in both
masters. Store exactly one category and at most three useful search tags. A metaphor
needs a real UI use case and a misuse note, especially for accessibility and security.
An icon's name is not automatically its accessible label: `download` may mean
“Download report”, depending on context.

Only navigation arrows and chevrons are `directional`. Mirror those in RTL when
`dir: 'rtl'` is passed to the renderer; static assets need an explicit CSS transform.
Do not mirror text, clocks, download arrows, checkmarks or familiar object silhouettes.
Never infer accessibility, disability, identity or trust from a vague symbol alone.

## Acceptance criteria (every icon, both masters)

| Review              | Passing result                                                                                                                                                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drawing frame       | Painted bounds, including curves, round caps and joins, stay inside the 2px / 3px inset. The build calculates curve extrema with a 0.000001px numerical tolerance. The 48px export preserves the doubled geometry and 6px inset.                                             |
| Symmetry and center | A symmetric shape shares its intended axis with the artboard or its container. A nested mark is centered in the usable body of its frame. Asymmetric shapes are compared beside the circle, square, check and search; their ink centroid alone does not determine placement. |
| Clear space         | Unrelated painted edges remain at least 1px apart at 16 and 1.5px apart at 24. Intended object junctions remain connected without stray caps, dense knots or trapped white slivers. Enclosed counters stay open at native size.                                              |
| Essential detail    | The action, direction, count and distinguishing features remain recognizable at 16 and 24, at DPR 1 and 2. An arrow has an exposed straight shaft behind its head. Simplification may remove decoration, but must preserve the meaning.                                      |
| Related shapes      | Variants share their base dimensions, axes, arrowhead proportions and badge placement at each optical size. A deliberate contour break leaves clear space for its badge. Explain any required shift in the optical note.                                                     |
| Text and scale      | Inspect 16, 24, 32 and 48px on both themes, centered in a square and beside the Latin/Korean font matrix above. No consumer-specific translation is required.                                                                                                                |
| Meaning and access  | Both masters depict the same meaning and follow the direction policy. Names, use cases and optical notes match the artwork. Decorative and named examples pass accessibility checks.                                                                                         |

Use measurements to find candidates, then inspect the complete glyph at native size
and enlarged. A small raster artifact, an intentional junction or an asymmetric
silhouette is not a reason to alter an icon on its own. Compare repairs with their
original artwork and with unchanged family members. Have a second reviewer inspect
the repaired shapes before merging. Keep temporary measurements and review images
out of the source tree.

See the [accessibility guidelines](docs/accessibility.md) and [contribution guide](CONTRIBUTING.md). Update these guidelines before changing the icon style.
