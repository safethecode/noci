import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const previewDirectory = new URL('../preview/', import.meta.url);
const distDirectory = new URL('../dist/', import.meta.url);
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/og.png', ['og.png', 'image/png']],
  ['/og.svg', ['og.svg', 'image/svg+xml']],
]);
const sizes = [16, 24, 48];

export async function createPreviewServer() {
  let snapshot;
  let refreshing = false;

  async function refresh() {
    if (refreshing) {
      return;
    }
    refreshing = true;
    try {
      // The build writes metadata after all sprites. Keep the last complete build
      // available while the next build replaces dist.
      const metadataPath = new URL('metadata.json', distDirectory);
      const before = await stat(metadataPath);
      const stamp = `${before.mtimeMs}-${before.size}`;
      if (snapshot?.stamp === stamp) {
        return;
      }
      const files = await Promise.all([
        readFile(metadataPath),
        ...sizes.map((size) => readFile(new URL(`sprite/${size}.svg`, distDirectory))),
      ]);
      const after = await stat(metadataPath);
      if (`${after.mtimeMs}-${after.size}` !== stamp) {
        return;
      }
      const metadata = JSON.parse(files[0].toString());
      if (
        !Array.isArray(metadata.icons) ||
        !metadata.icons.length ||
        files.slice(1).some((file) => !file.toString().trim().endsWith('</svg>'))
      ) {
        return;
      }
      const hash = createHash('sha256');
      for (const file of files) {
        hash.update(file);
      }
      snapshot = { stamp, files, version: hash.digest('hex').slice(0, 16) };
    } catch {
      // A build may temporarily remove or replace a file. Retry on the next poll.
    } finally {
      refreshing = false;
    }
  }

  await refresh();
  if (!snapshot) {
    throw new Error('Build the icons with npm run build before starting the preview.');
  }

  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end('Method not allowed');
      return;
    }
    try {
      const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
      const asset = assets.get(pathname);
      let body;
      let contentType;
      const current = snapshot;
      if (asset) {
        body = await readFile(new URL(asset[0], previewDirectory));
        contentType = asset[1];
        if (pathname === '/') {
          const siteURL = `${new URL(`http://${request.headers.host}`).origin}/`;
          body = Buffer.from(
            body.toString().replaceAll('{{preview-url}}', siteURL.replaceAll('&', '&amp;')),
          );
        }
      } else if (pathname === '/metadata.json') {
        body = current.files[0];
        contentType = 'application/json; charset=utf-8';
      } else {
        const sprite = pathname.match(/^\/sprite\/(16|24|48)\.svg$/);
        if (sprite) {
          body = current.files[sizes.indexOf(Number(sprite[1])) + 1];
          contentType = 'image/svg+xml';
        }
      }
      if (!body) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      const etag = `"${current.version}"`;
      if (pathname === '/metadata.json' && request.headers['if-none-match'] === etag) {
        response.writeHead(304, {
          ETag: etag,
          'Cache-Control': 'no-store',
          'X-Noci-Version': current.version,
        });
        response.end();
        return;
      }
      response.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': body.length,
        'Cache-Control': 'no-store',
        ETag: etag,
        'X-Noci-Version': current.version,
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Could not load the preview.');
    }
  });
  const timer = setInterval(refresh, 4000);
  timer.unref();
  server.once('close', () => clearInterval(timer));
  return server;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const port = Number(process.env.NOCI_PREVIEW_PORT ?? 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('NOCI_PREVIEW_PORT must be an integer from 1 to 65535.');
  }
  const server = await createPreviewServer();
  server.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Noci preview: http://127.0.0.1:${port}`);
  });
}
