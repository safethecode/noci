import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createPreviewServer } from '../scripts/preview.mjs';

test('the preview serves its source and one consistent icon build', async (t) => {
  const server = await createPreviewServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;

  for (const [path, file, type] of [
    ['/', 'index.html', 'text/html'],
    ['/styles.css', 'styles.css', 'text/css'],
    ['/app.mjs', 'app.mjs', 'text/javascript'],
    ['/og.png', 'og.png', 'image/png'],
    ['/og.svg', 'og.svg', 'image/svg+xml'],
  ]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type').startsWith(type));
    const source = await readFile(new URL(`../preview/${file}`, import.meta.url));
    const expected =
      file === 'index.html'
        ? Buffer.from(source.toString().replaceAll('{{preview-origin}}', origin))
        : source;
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
  }

  const metadataResponse = await fetch(`${origin}/metadata.json`);
  const version = metadataResponse.headers.get('x-noci-version');
  assert.ok(version);
  const metadata = await metadataResponse.json();
  assert.ok(metadata.icons.length > 0);
  const unchanged = await fetch(`${origin}/metadata.json`, {
    headers: { 'If-None-Match': metadataResponse.headers.get('etag') },
  });
  assert.equal(unchanged.status, 304);
  assert.equal(unchanged.headers.get('x-noci-version'), version);
  assert.equal(await unchanged.text(), '');
  for (const size of [16, 24, 48]) {
    const response = await fetch(`${origin}/sprite/${size}.svg?v=${version}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-noci-version'), version);
    const svg = await response.text();
    for (const icon of metadata.icons) {
      assert.ok(svg.includes(`id="noci-${icon.name}-${size}"`));
    }
  }

  const head = await fetch(`${origin}/app.mjs`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.ok(Number(head.headers.get('content-length')) > 0);
  const unknown = await fetch(`${origin}/src/core.ts`);
  assert.equal(unknown.status, 404);
  await unknown.text();
});
