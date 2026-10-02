import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * `Get-DataTarget` names where data/ links to without any tracked file spelling it (D125): data.toml
 * names the place by root, `raw:WekaExt/scene-graph-studio`, and devdata's roots file, outside every
 * repository, maps the root to a folder on this machine. Until D125 the script held the folder as a
 * literal, the one thing `devdata lint` exists to find.
 *
 * Run under pwsh, and skipped where pwsh is absent, as it may be on a Linux runner.
 */

const SCRIPT = resolve(import.meta.dirname, '../Connect-DataDirectory.ps1');
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf-8' }).status === 0;
const roots = [];
afterAll(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

/** A track holding a data.toml, and a roots file mapping `raw` to a folder that need not exist. */
function machine() {
  const root = mkdtempSync(join(tmpdir(), 'sgs-connect-'));
  roots.push(root);
  const track = join(root, 'track');
  mkdirSync(track);
  writeFileSync(join(track, 'data.toml'), '[entries.data]\nkind = "dataset"\npath = "data"\nsource = "raw:WekaExt/scene-graph-studio"\n');
  const rootsFile = join(root, 'roots.toml');
  writeFileSync(rootsFile, "# a machine's roots\n[roots]\nmotor = 'X:\\Motor'\nraw   = 'X:\\Nas'\n");
  return { track, rootsFile };
}

const target = (track, env) =>
  execFileSync('pwsh', ['-NoProfile', '-Command', `. '${SCRIPT}'; Get-DataTarget -Track '${track}'`], {
    encoding: 'utf-8',
    env: { ...process.env, SGS_DATA_DIR: '', ...env },
  }).trim();

describe.skipIf(!hasPwsh)('Get-DataTarget', () => {
  it("joins the roots file's root and data.toml's path, as devdata pull does", () => {
    const { track, rootsFile } = machine();
    expect(target(track, { DEVDATA_ROOTS_FILE: rootsFile })).toBe('X:\\Nas\\WekaExt\\scene-graph-studio');
  });

  it('gives way to SGS_DATA_DIR', () => {
    const { track, rootsFile } = machine();
    expect(target(track, { DEVDATA_ROOTS_FILE: rootsFile, SGS_DATA_DIR: 'Y:\\Elsewhere\\' })).toBe('Y:\\Elsewhere');
  });

  it('names nothing when the roots file is absent, and the script holds no folder of its own', () => {
    const { track, rootsFile } = machine();
    expect(target(track, { DEVDATA_ROOTS_FILE: `${rootsFile}.absent` })).toBe('');
  });
});
