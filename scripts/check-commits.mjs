import { execFileSync } from 'node:child_process';

const base = process.env.NOCI_BASE_SHA;
if (!base || !/^[a-f0-9]{40}$/.test(base)) throw new Error('NOCI_BASE_SHA must be the PR base commit.');
const subjects = execFileSync('git', ['log', `${base}..HEAD`, '--format=%s', '--no-merges'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const pattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\([a-z0-9./-]+\))?!?: .{1,100}$/;
const invalid = subjects.filter(x => !pattern.test(x));
if (invalid.length) throw new Error(`Use Karma commit subjects:\n${invalid.join('\n')}`);
console.log(`Validated ${subjects.length} Karma commit subjects.`);
