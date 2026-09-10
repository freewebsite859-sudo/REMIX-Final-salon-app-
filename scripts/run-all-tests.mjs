#!/usr/bin/env node
/**
 * Aggregate test runner — `npm test`.
 *
 * Every suite in this repo is a standalone `tsx` script that prints its own
 * PASS/FAIL lines and exits non-zero on failure. This runner executes all
 * `test:*` scripts, keeps their output, and reports one summary table so a
 * single command answers "is the build green?".
 *
 * Usage:
 *   npm test                 run everything
 *   npm test -- referral     run only suites whose name matches "referral"
 *   npm test -- --list       list the suites without running them
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

const allSuites = Object.keys(pkg.scripts)
  .filter((name) => name.startsWith('test:'))
  .sort();

const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const filter = args.filter((a) => !a.startsWith('--')).join(' ').toLowerCase();

const suites = filter ? allSuites.filter((s) => s.toLowerCase().includes(filter)) : allSuites;

if (suites.length === 0) {
  console.error(`No test suite matches "${filter}". Available:\n  ${allSuites.join('\n  ')}`);
  process.exit(1);
}

if (listOnly) {
  console.log(suites.join('\n'));
  process.exit(0);
}

console.log(`Nexora test suite — ${suites.length} suites\n${'='.repeat(64)}`);

const results = [];
const startedAt = Date.now();

for (const suite of suites) {
  const t0 = Date.now();
  const run = spawnSync('npm', ['run', '--silent', suite], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
  });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const ms = Date.now() - t0;

  // Prefer the suite's own tally line ("44/44 … passed") when it prints one.
  const tally = output.match(/(\d+)\s*\/\s*(\d+)[^\n]*passed/);
  const failedLines = output
    .split('\n')
    .filter((l) => /^FAIL\b/.test(l.trim()))
    .slice(0, 5);

  const timedOut = run.error?.code === 'ETIMEDOUT';
  const ok = run.status === 0 && !timedOut;

  results.push({
    suite,
    ok,
    ms,
    tally: tally ? `${tally[1]}/${tally[2]}` : null,
    failedLines,
    tail: output.trim().split('\n').slice(-6).join('\n'),
  });

  const mark = ok ? 'PASS' : 'FAIL';
  console.log(
    `${mark}  ${suite.padEnd(26)} ${tally ? tally[1] + '/' + tally[2] : ''}`.padEnd(46) +
      `${(ms / 1000).toFixed(1)}s`
  );
}

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;

console.log(`${'='.repeat(64)}`);
console.log(
  `${passed}/${results.length} suites passed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`
);

if (failed > 0) {
  console.log(`\nFAILING SUITES:`);
  for (const r of results.filter((x) => !x.ok)) {
    console.log(`\n--- ${r.suite} ---`);
    if (r.failedLines.length > 0) {
      console.log(r.failedLines.join('\n'));
    } else {
      console.log(r.tail);
    }
  }
}

process.exit(failed > 0 ? 1 : 0);
