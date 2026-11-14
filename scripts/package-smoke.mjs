import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'noci-package-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
try {
  const [packed] = JSON.parse(
    execFileSync(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', directory], {
      cwd: root,
      encoding: 'utf8',
    }),
  );
  assert.ok(packed.files.some((x) => x.path === 'dist/core.d.ts'));
  assert.ok(
    packed.files.every(
      (x) =>
        x.path.startsWith('dist/') ||
        ['package.json', 'README.md', 'README.ko.md', 'LICENSE'].includes(x.path),
    ),
    'Tarball contains development or one-off files.',
  );
  const consumer = join(directory, 'consumer');
  await mkdir(consumer);
  await writeFile(join(consumer, 'package.json'), '{"private":true,"type":"module"}\n');
  execFileSync(
    npm,
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(directory, packed.filename)],
    { cwd: consumer, stdio: 'pipe' },
  );
  const metadata = JSON.parse(await readFile(join(root, 'dist/metadata.json'), 'utf8'));
  assert.ok(metadata.count > 0, 'A release candidate must contain artwork.');
  const name = metadata.icons[0].name,
    symbol = metadata.icons[0].exportName;
  await writeFile(
    join(consumer, 'smoke.mjs'),
    `import assert from 'node:assert/strict';
import { renderIcon, ${symbol} } from 'noci-icons';
import icon from 'noci-icons/icons/${name}';
import { readFile } from 'node:fs/promises';
assert.deepEqual(icon, ${symbol});
assert.match(renderIcon(icon, {label:'Installed'}), /role="img"/);
assert.ok((await readFile(new URL(import.meta.resolve('noci-icons/svg/48/${name}.svg')), 'utf8')).includes('0 0 48 48'));
assert.ok(import.meta.resolve('noci-icons/styles.css'));
assert.equal(typeof globalThis.document, 'undefined');
`,
  );
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: consumer, stdio: 'inherit' });
  execFileSync(
    process.execPath,
    [
      '-e',
      `const assert=require('node:assert/strict');const n=require('noci-icons');const icon=require('noci-icons/icons/${name}').default;assert.deepEqual(icon,n.${symbol});assert.ok(n.renderIcon(icon).includes('aria-hidden="true"'));`,
    ],
    { cwd: consumer, stdio: 'inherit' },
  );
  await writeFile(
    join(consumer, 'types.mts'),
    `import icon from 'noci-icons/icons/${name}';\nimport {renderIcon} from 'noci-icons/core';\nconst svg:string=renderIcon(icon,{size:'1em'});\nvoid svg;\n`,
  );
  await writeFile(
    join(consumer, 'types.cts'),
    `import noci = require('noci-icons/core');\nimport icon = require('noci-icons/icons/${name}');\nconst svg:string=noci.renderIcon(icon.default);\nvoid svg;\n`,
  );
  execFileSync(
    join(root, 'node_modules/.bin/tsc'),
    [
      '--noEmit',
      '--strict',
      '--target',
      'ES2022',
      '--lib',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      'types.mts',
      'types.cts',
    ],
    { cwd: consumer, stdio: 'inherit' },
  );
  console.log(
    `Installed tarball verified: ESM, CJS, types and SVG/CSS exports; ${packed.entryCount} files, ${packed.size} archive bytes.`,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
