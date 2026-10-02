import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { requireDataDir } from '../data_dir.mjs';

/**
 * Rule 10.4 of the devdata spec (D125): the harvest writes through data/ and never creates it.
 *
 * `mkdirSync(..., { recursive: true })` made `../data` a real directory wherever the link to the
 * NAS was missing, which devdata reports as `occupied`, and the harvest's output then lay in no
 * place any other checkout reads.
 */

const SYSTEM = resolve(import.meta.dirname, '../..');
const roots = [];
afterAll(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function scratch() {
  const root = mkdtempSync(join(tmpdir(), 'sgs-data-guard-'));
  roots.push(root);
  return root;
}

describe('requireDataDir', () => {
  it('stops, names devdata pull, and creates nothing when data/ is absent', () => {
    const absent = join(scratch(), 'data');
    expect(() => requireDataDir(absent)).toThrow(/devdata pull/);
    expect(existsSync(absent)).toBe(false);
  });

  it('returns a data directory that is there', () => {
    const root = scratch();
    expect(requireDataDir(root)).toBe(root);
  });
});

describe('the harvest', () => {
  it('run without data/, exits non-zero, names devdata pull, and creates nothing', () => {
    const absent = join(scratch(), 'data');
    let failure;
    try {
      execFileSync(process.execPath, ['tools/harvest.mjs'], {
        cwd: SYSTEM,
        env: { ...process.env, SGS_DATA_DIR: absent },
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (error) {
      failure = error;
    }
    expect(failure, 'the harvest ran to the end').toBeDefined();
    expect(failure.status).not.toBe(0);
    expect(failure.stderr).toMatch(/devdata pull/);
    expect(existsSync(absent)).toBe(false);
  });
});
