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
8. Run `npm run qa:openings` to find cramped enclosed spaces, including wedges
   formed by intersecting strokes. Check open gaps and missing counters visually.
9. Enlarge connected strokes to inspect their complete painted edges. A segment
   that joins an outer contour must end within its ink, without a cap protruding
   beyond the silhouette. Check both ends and return to native size afterward.

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

## Acceptance checklist (every icon, both masters)

- Meaning is recognizable; adjacent text is included where the metaphor is ambiguous.
- Insets, size, stroke, currentColor, primitive allowlist and tag cap pass validation.
- Related icons share their base geometry; separate marks have the specified gaps.
- No clipping, accidental tangencies, doubled strokes or dense knots at native size.
- It appears balanced in a centered square and paired with the font matrix.
- Metadata documents optical decisions, RTL policy, use case and meaning.
- Decorative and named examples pass automated accessibility checks.
- Review the rendered icons; automated checks support visual review.

See the [accessibility guidelines](docs/accessibility.md) and [contribution guide](CONTRIBUTING.md). Update these guidelines before changing the icon style.
