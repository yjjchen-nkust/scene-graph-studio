import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * `kp_latex.mjs` as its usage line runs it: a subprocess, from `system/`, over a fixture corpus.
 *
 * Its CLI guard compared `import.meta.url` with `file://` and the script's path, which on Windows
 * is `file://C:/…` against `file:///C:/…`. The command printed nothing and exited 0, which reads as
 * a point with no formula. On a POSIX runner the two strings agreed, so this test can only fail on
 * Windows; there it did.
 */

const CLI = resolve(import.meta.dirname, '../kp_latex.mjs');
const roots = [];

/** A `system/` directory whose `../data/content/` holds one point, Q1, with one formula and two derivation blocks. */
function corpus() {
  const root = mkdtempSync(join(tmpdir(), 'sgs-kp-latex-'));
  roots.push(root);
  mkdirSync(join(root, 'data/content'), { recursive: true });
  mkdirSync(join(root, 'system'), { recursive: true });
  writeFileSync(join(root, 'data/content/math.json'), JSON.stringify({ Q1: '\\[ a+b \\]' }), 'utf-8');
  writeFileSync(join(root, 'data/content/deriv.json'), JSON.stringify({ Q1: '\\[ c \\] then \\[ d \\]' }), 'utf-8');
  return join(root, 'system');
}

const run = (cwd, ...args) => execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf-8' });

afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

describe('kp_latex CLI', () => {
  it('prints every block of a point, re-delimited for MDX', () => {
    expect(run(corpus(), 'Q1')).toBe('$$\na+b\n$$\n\n$$\nc\n$$\n\n$$\nd\n$$\n\n');
  });

  it('prints the formula alone, or one derivation block', () => {
    const cwd = corpus();
    expect(run(cwd, 'Q1', 'math')).toBe('$$\na+b\n$$\n\n');
    expect(run(cwd, 'Q1', 'deriv', '1')).toBe('$$\nd\n$$\n\n');
  });
});
