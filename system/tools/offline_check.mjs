#!/usr/bin/env node
/**
 * Check 6 of `docs/VERIFICATION.md`: the offline run, made repeatable.
 *
 * The check asks for three conditions. Only one of them is a property of the machine; the other
 * two were arranged by hand until this script existed, which meant the check could be run once,
 * on a laptop nobody would reproduce.
 *
 * | Condition | How this script arranges it |
 * |---|---|
 * | `torch` uninstalled | the backend runs on an interpreter where `torch` is not importable |
 * | slices never fetched | `SGS_DATA_DIR` points at a scratch directory holding only the placeholder slice |
 * | the network down | Playwright aborts every request to anything but this origin, and the run fails on the attempt |
 *
 * The third is **stricter than unplugging a cable**. A disconnected machine tells you the
 * application survived a fetch it should never have made; interception tells you it never made
 * one, which is what NFR-1 actually states.
 *
 * Nothing here touches the author's `data/`. That directory is read-only to this script, and the
 * scratch copy is built by `make_placeholders.py`, which every clone can run.
 *
 * Usage:
 *   node tools/offline_check.mjs --python <path to a torch-free interpreter>
 *
 * With no `--python`, the interpreter on PATH is used and the script refuses to continue if
 * `torch` is importable from it, naming what to do instead. It refuses rather than warning
 * because a run with `torch` present is not this check, and recording it as though it were is
 * the one outcome worse than not running it.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// The one Python step that deliberately does NOT use the project interpreter. py12 carries
// torch (2.9.1+cpu), and condition 1 below is that torch is not importable, so resolving to it
// would make this check refuse every run. It needs a purpose-built torch-free environment,
// which is what the usage note above asks for.
const args = process.argv.slice(2);
const pythonFlag = args.indexOf('--python');
const PYTHON = resolveInterpreter(pythonFlag >= 0 ? args[pythonFlag + 1] : 'python');
const KEEP = args.includes('--keep');

/**
 * An interpreter given as a path is resolved against this script's cwd, not the backend's.
 *
 * The backend is spawned with `cwd: 'backend'`, so a relative `--python .offline-venv/Scripts/python`
 * -- which is exactly what this file's own usage note tells you to type -- was resolved one
 * directory too deep and failed with a spawn ENOENT that named the interpreter and not the cwd.
 * A bare name like `python` is a PATH lookup and must stay as it is.
 */
function resolveInterpreter(value) {
  return /[\\/]/.test(value) ? resolve(value) : value;
}


function die(message, hint) {
  console.error(`\noffline check: ${message}`);
  if (hint) console.error(hint);
  process.exit(1);
}

// ---- condition 1: torch is not importable -----------------------------------------------
const probe = spawnSync(
  PYTHON,
  ['-c', 'import importlib.util,sys;print(sys.version.split()[0]);print(importlib.util.find_spec("torch") is not None)'],
  { encoding: 'utf-8' },
);
if (probe.status !== 0) {
  die(`could not run ${PYTHON}`, probe.stderr?.trim());
}
const [pyVersion, torchPresent] = probe.stdout.trim().split(/\r?\n/);
if (torchPresent !== 'False') {
  die(
    `torch is importable from ${PYTHON}, so this is not the offline check.`,
    [
      'Build an interpreter without it and pass it in:',
      '',
      '  python -m venv .offline-venv',
      '  .offline-venv/Scripts/python -m pip install -r backend/requirements.txt',
      '  node tools/offline_check.mjs --python .offline-venv/Scripts/python',
      '',
      'requirements.txt does not list torch: it is optional, and the live tier is the only',
      'thing that wants it. A venv built from that file is torch-free by construction.',
    ].join('\n'),
  );
}

// ---- condition 2: a data directory with nothing fetched ---------------------------------
const scratch = mkdtempSync(join(tmpdir(), 'sgs-offline-'));
const env = { ...process.env, SGS_DATA_DIR: scratch, SGS_CORPUS_ROOT: join(scratch, '_raw') };

console.log(`offline check`);
console.log(`  interpreter : ${PYTHON} (${pyVersion}), torch importable: false`);
console.log(`  data dir    : ${scratch}`);

// Seeded before the placeholders, not after: `make_placeholders.py` consults the licence gate,
// which reads LICENCES.md out of DATA_DIR, and refuses to write a slice the file does not clear.
//
// The golden vectors and the content corpus are code, not fetched data, and several modules read
// them from DATA_DIR. Copy the committed ones across so the scratch directory is a clone's
// data/, not an empty one -- "never fetched" is about images, not about the repository.
const copy = spawnSync(
  PYTHON,
  [
    '-c',
    [
      'import shutil,sys,pathlib',
      'src=pathlib.Path("../data"); dst=pathlib.Path(sys.argv[1])',
      'for name in ("golden","content","vlm","predictions","mini-isg"):',
      '    s=src/name',
      '    if s.is_dir(): shutil.copytree(s, dst/name, dirs_exist_ok=True)',
      'shutil.copy2(src/"LICENCES.md", dst/"LICENCES.md")',
      // Annotations are committed; images are not. Copy the annotations and leave the images
      // absent, which is exactly the state of a fresh clone.
      'for s in (src/"slices").iterdir():',
      '    if not s.is_dir() or s.name == "placeholder": continue',
      '    d=dst/"slices"/s.name; d.mkdir(parents=True, exist_ok=True)',
      '    for f in s.glob("*.json"): shutil.copy2(f, d/f.name)',
      '    (d/"images").mkdir(exist_ok=True)',
    ].join('\n'),
    scratch,
  ],
  { env, encoding: 'utf-8' },
);
if (copy.status !== 0) die('could not seed the scratch data directory', copy.stderr?.trim());
console.log(`  annotations : committed ones copied, image directories left empty`);

const placeholders = spawnSync(PYTHON, ['backend/scripts/make_placeholders.py'], {
  env,
  encoding: 'utf-8',
  stdio: 'pipe',
});
if (placeholders.status !== 0) {
  die('make_placeholders.py failed in the scratch directory', placeholders.stderr?.trim());
}
console.log(`  slices      : placeholder only, generated just now`);

// ---- run ---------------------------------------------------------------------------------
const backend = spawn(
  PYTHON,
  ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8111', '--log-level', 'warning'],
  { cwd: 'backend', env, stdio: 'inherit' },
);

function stop() {
  backend.kill();
  if (!KEEP) rmSync(scratch, { recursive: true, force: true });
}
process.on('exit', stop);
process.on('SIGINT', () => process.exit(130));

await new Promise((resolve, reject) => {
  const started = Date.now();
  const poll = setInterval(async () => {
    try {
      const r = await fetch('http://127.0.0.1:8111/api/health');
      if (r.ok) {
        clearInterval(poll);
        const body = await r.json();
        if (body.torch_present) reject(new Error('the backend reports torch present'));
        else resolve();
      }
    } catch {
      if (Date.now() - started > 30_000) {
        clearInterval(poll);
        reject(new Error('the backend did not start within 30s'));
      }
    }
  }, 300);
}).catch((error) => die(error.message));

console.log(`  backend     : 127.0.0.1:8111, torch_present false\n`);

// `node node_modules/@playwright/test/cli.js`, not `npx playwright`: Node refuses to spawn a
// `.cmd` without a shell since the 2024 argument-injection fix, and `shell: true` on Windows
// would put this script's paths through cmd quoting for no benefit.
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const playwright = spawnSync(process.execPath, [cli, 'test', 'e2e/offline.spec.ts'], {
  env: { ...env, SGS_BACKEND_PORT: '8111', SGS_OFFLINE: '1' },
  stdio: 'inherit',
});
if (playwright.error) die(`could not run Playwright: ${playwright.error.message}`);

stop();
process.exit(playwright.status ?? 1);
