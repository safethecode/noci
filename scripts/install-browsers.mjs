import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

execFileSync(process.execPath, [fileURLToPath(new URL('../node_modules/playwright/cli.js', import.meta.url)), 'install', 'chromium', 'firefox', 'webkit', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? fileURLToPath(new URL('../.cache/playwright', import.meta.url)) }
});
