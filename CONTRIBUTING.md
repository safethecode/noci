# Contributing

Read the [design guidelines](DESIGN.md) and [accessibility guidelines](docs/accessibility.md).

## Icon files

```text
icons/<category>/<name>/
  16.svg
  24.svg
  meta.json
```

Draw each size separately. Use the same name and meaning for both sizes. The build generates 48px SVGs, modules, types, sprites and package metadata.

Metadata includes the name, category, description, up to three tags, RTL behavior, use case, misuse note and optical notes for each size. Optical offsets are included in the coordinates, so consumers do not need to apply them again.

Use original artwork. Preserve any license notices required by contributed material.

## Checks

```sh
npm ci
npm run check
npm run browsers:install
npm run test:browser
npm run qa
npm run qa:marks
npm run qa:openings
npm run qa -- --category navigation
npm run qa -- --name search --theme dark
```

Inspect icons at their actual sizes on light and dark backgrounds. Check square containers and text in different fonts. Keep related shapes and baselines consistent. Inspect small gaps, intersections and clipping.

## Commits and pull requests

- Use Karma commit messages: `type(scope): summary`.
- Commit each icon's two sizes and metadata together.
- Keep one meaningful commit per icon or feature on the PR branch.
- Fold follow-up corrections into the corresponding icon or feature commit.
- Group icons by category in pull requests.
- Use the PR body to list the icons or features added.
- Squash-merge each coherent category or repair PR into `main` with a Karma title.
- Use at most three icon tags and three PR labels.

Commit source files, reusable tools and tests. Exclude generated files, screenshots, temporary analysis, browser downloads and package archives.
