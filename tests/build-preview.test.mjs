import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildPreview } from '../scripts/build-preview.mjs';

test('a static preview preserves icons and resolves assets under a project path', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'noci-pages-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const result = await buildPreview({
    siteURL: 'https://example.test/noci',
    outputDirectory: directory,
  });
  assert.equal(result.siteURL, 'https://example.test/noci/');
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  assert.ok(!html.includes('{{preview-url}}'));
  assert.match(html, /content="https:\/\/example\.test\/noci\/og.png"/);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = new URL(match[1], result.siteURL);
    if (url.origin !== 'https://example.test' || url.hash) {
      continue;
    }
    assert.ok(url.pathname.startsWith('/noci/'), `${url} escapes the project path.`);
    await stat(join(directory, url.pathname.slice('/noci/'.length)));
  }

  const metadata = JSON.parse(await readFile(join(directory, 'metadata.json'), 'utf8'));
  const original = JSON.parse(
    await readFile(new URL('../dist/metadata.json', import.meta.url), 'utf8'),
  );
  assert.equal(metadata.count, original.icons.length);
  assert.equal(result.count, metadata.count);
  assert.match(metadata.buildVersion, /^[a-f0-9]{16}$/);
  assert.deepEqual(
    metadata.icons,
    original.icons.map(({ name, category, description, tags, useCase }) => ({
      name,
      category,
      description,
      tags,
      useCase,
    })),
  );
  for (const size of [16, 24, 48]) {
    assert.deepEqual(
      await readFile(join(directory, 'sprite', `${size}.svg`)),
      await readFile(new URL(`../dist/sprite/${size}.svg`, import.meta.url)),
    );
  }
  for (const name of ['app.mjs', 'styles.css', 'og.png', 'og.svg']) {
    assert.deepEqual(
      await readFile(join(directory, name)),
      await readFile(new URL(`../preview/${name}`, import.meta.url)),
    );
  }
});
