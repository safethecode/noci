import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const previewDirectory = new URL('../preview/', import.meta.url);
const distDirectory = new URL('../dist/', import.meta.url);

export async function buildPreview({
  siteURL = 'https://safethecode.github.io/noci/',
  outputDirectory = fileURLToPath(new URL('../artifacts/preview/', import.meta.url)),
} = {}) {
  const url = new URL(siteURL);
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) {
    throw new Error('The preview URL must be an HTTP or HTTPS URL without a query or fragment.');
  }
  if (!url.pathname.endsWith('/')) {
    url.pathname += '/';
  }

  const source = JSON.parse(await readFile(new URL('metadata.json', distDirectory), 'utf8'));
  const metadata = {
    version: source.version,
    count: source.icons.length,
    icons: source.icons.map(({ name, category, description, tags, useCase }) => ({
      name,
      category,
      description,
      tags,
      useCase,
    })),
  };
  const sprites = await Promise.all(
    [16, 24, 48].map((size) => readFile(new URL(`sprite/${size}.svg`, distDirectory))),
  );
  const hash = createHash('sha256').update(JSON.stringify(metadata));
  for (const sprite of sprites) {
    hash.update(sprite);
  }
  const buildVersion = hash.digest('hex').slice(0, 16);
  const html = (await readFile(new URL('index.html', previewDirectory), 'utf8')).replaceAll(
    '{{preview-url}}',
    url.href.replaceAll('&', '&amp;'),
  );

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(join(outputDirectory, 'sprite'), { recursive: true });
  await Promise.all([
    writeFile(join(outputDirectory, 'index.html'), html),
    writeFile(
      join(outputDirectory, 'metadata.json'),
      JSON.stringify({ ...metadata, buildVersion }),
    ),
    writeFile(join(outputDirectory, '.nojekyll'), ''),
    copyFile(new URL('../LICENSE', import.meta.url), join(outputDirectory, 'LICENSE')),
    ...['styles.css', 'app.mjs', 'og.png', 'og.svg'].map((name) =>
      copyFile(new URL(name, previewDirectory), join(outputDirectory, name)),
    ),
    ...[16, 24, 48].map((size, index) =>
      writeFile(join(outputDirectory, 'sprite', `${size}.svg`), sprites[index]),
    ),
  ]);
  return { siteURL: url.href, count: metadata.count, buildVersion };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const result = await buildPreview({ siteURL: process.env.NOCI_PREVIEW_URL });
  console.log(`Built ${result.count} icons for ${result.siteURL}`);
}
