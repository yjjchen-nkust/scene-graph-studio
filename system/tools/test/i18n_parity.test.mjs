import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * The rules of `i18n_parity.mjs`, each shown failing on a two-locale fixture (D103).
 *
 * The script reads `frontend/src/i18n/<locale>.json` relative to the working directory and exits,
 * so, as with `content_lint.test.mjs`, a fixture is a directory of that shape run as a subprocess.
 */

const PARITY = resolve(import.meta.dirname, '../i18n_parity.mjs');
const roots = [];

/** A fixture directory holding the two tables. */
function tables(en, zh) {
  const root = mkdtempSync(join(tmpdir(), 'sgs-i18n-'));
  roots.push(root);
  const dir = join(root, 'frontend', 'src', 'i18n');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'en.json'), JSON.stringify(en));
  writeFileSync(join(dir, 'zh-TW.json'), JSON.stringify(zh));
  return root;
}

function parity(cwd) {
  try {
    const out = execFileSync(process.execPath, [PARITY], { cwd, encoding: 'utf-8', stdio: 'pipe' });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe('i18n parity', () => {
  it('accepts two tables with the same keys and the same placeholders', () => {
    const run = parity(tables(
      { 'a.picture': 'Frame {frame}', 'a.plain': 'Plain' },
      { 'a.picture': '影格 {frame}', 'a.plain': '純文字' },
    ));
    expect(run.out).toContain('i18n parity: 2 keys, both locales complete');
    expect(run.ok).toBe(true);
  });

  it('refuses a key present in one locale only', () => {
    const run = parity(tables({ 'a.only': 'Only' }, {}));
    expect(run.ok).toBe(false);
    expect(run.out).toContain('a.only: present in en, missing from zh-TW');
  });

  it('refuses an empty value', () => {
    const run = parity(tables({ 'a.empty': 'Empty' }, { 'a.empty': ' ' }));
    expect(run.ok).toBe(false);
    expect(run.out).toContain('a.empty: empty or non-string value in zh-TW');
  });

  it('refuses a placeholder one locale has and the other lacks', () => {
    // 繁體中文 would print the frame nowhere, and no English test would notice.
    const run = parity(tables({ 'a.picture': 'Frame {frame}' }, { 'a.picture': '影格' }));
    expect(run.ok).toBe(false);
    expect(run.out).toContain('a.picture: placeholders differ, en {frame}, zh-TW none');
  });

  it('refuses a placeholder one locale repeats', () => {
    // Callers fill a placeholder with String.replace, which fills its first occurrence only.
    const run = parity(tables(
      { 'a.range': 'from {n} boxes' },
      { 'a.range': '{n} 至 {n} 個框' },
    ));
    expect(run.ok).toBe(false);
    expect(run.out).toContain('a.range: placeholders differ, en {n}, zh-TW {n} {n}');
  });
});
