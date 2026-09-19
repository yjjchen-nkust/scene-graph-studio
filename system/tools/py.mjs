// The one place that decides which Python interpreter this project runs on.
//
// The project's Python work belongs to the global virtual environment `py12` (Python 3.12,
// created as `C:\Python\pyVenv\py12`). Before this file, every Python step spelled the
// interpreter as the bare name `python`, so what actually ran was whatever PATH resolved
// first -- on this machine the machine-wide 3.12, on a student's machine anything at all.
// Two interpreters with different package sets is the failure this prevents: CI green in one
// shell and red in the next, with nothing in the repository recording which one was meant.
//
// Resolution order, highest first:
//   1. SGS_PYTHON            -- an explicit override always wins, including in CI.
//   2. VIRTUAL_ENV named py12 -- an already-activated py12 is the one the user chose.
//   3. py12 on disk          -- PY12_HOME, then the known locations (`py12Candidates`).
//   4. `python` on PATH      -- with a warning, because this is the case the project cannot
//                               vouch for. `start.ps1` turns that warning into a prompt and
//                               lets the user pick one of their own environments instead.
//
// Run it as a command to put anything on that interpreter:
//   node tools/py.mjs -m pytest backend/tests -q
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { posix, win32 } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

// The platform is an argument here, not an ambient fact. `node:path`'s own `join` and
// `basename` follow the host, so a resolver written with them can only be asserted on the host
// the test happens to run on -- which is how seven Windows-shaped assertions passed on this
// machine and failed on a Linux runner for three consecutive pushes. Choosing `win32` or
// `posix` explicitly lets both layouts be asserted from either machine.
function layout(platform) {
  return platform === 'win32' ? win32 : posix;
}

/** The interpreter inside a virtual-environment directory, under the named platform. */
function interpreterIn(dir, platform) {
  const path = layout(platform);
  return platform === 'win32'
    ? path.join(dir, 'Scripts', 'python.exe')
    : path.join(dir, 'bin', 'python');
}

/**
 * Where a `py12` environment is looked for, in order. PY12_HOME is how a machine that keeps
 * it elsewhere says so without editing this file.
 */
export function py12Candidates(env = process.env, { platform = process.platform } = {}) {
  const path = layout(platform);
  const dirs = [];
  if (env.PY12_HOME) dirs.push(env.PY12_HOME);
  if (env.WORKON_HOME) dirs.push(path.join(env.WORKON_HOME, 'py12'));
  if (env.USERPROFILE) {
    dirs.push(
      path.join(env.USERPROFILE, 'pyVenv', 'py12'),
      path.join(env.USERPROFILE, '.virtualenvs', 'py12'),
      path.join(env.USERPROFILE, 'venvs', 'py12'),
    );
  }
  if (env.HOME) {
    dirs.push(
      path.join(env.HOME, 'pyVenv', 'py12'),
      path.join(env.HOME, '.virtualenvs', 'py12'),
      path.join(env.HOME, 'venvs', 'py12'),
    );
  }
  // The machine-wide locations are Windows ones: `py12` is created as `C:\Python\pyVenv\py12`,
  // and both machines of D-02 are Windows. Offering them on a POSIX host produced three entries
  // that could never exist and could not be asserted either, a drive-letter string joined
  // POSIX-style being neither one layout nor the other.
  if (platform === 'win32') {
    dirs.push('C:\\Python\\pyVenv\\py12', 'C:\\venvs\\py12', 'D:\\Python\\pyVenv\\py12');
  }
  // An arrow, not a bare reference: `map` passes the index as a second argument, which the
  // platform parameter would otherwise receive.
  return dirs.map((dir) => interpreterIn(dir, platform));
}

/**
 * Decide the interpreter. Pure: everything it reads comes in through `env`, `exists` and
 * `platform`, which is what lets the resolution order be asserted rather than described.
 *
 * @returns {{python: string, source: string, warning: string|null}}
 */
export function pickPython({
  env = process.env,
  exists = existsSync,
  platform = process.platform,
} = {}) {
  if (env.SGS_PYTHON) {
    return { python: env.SGS_PYTHON, source: 'SGS_PYTHON', warning: null };
  }

  if (env.VIRTUAL_ENV && layout(platform).basename(env.VIRTUAL_ENV).toLowerCase() === 'py12') {
    const active = interpreterIn(env.VIRTUAL_ENV, platform);
    if (exists(active)) return { python: active, source: 'VIRTUAL_ENV', warning: null };
  }

  for (const candidate of py12Candidates(env, { platform })) {
    if (exists(candidate)) return { python: candidate, source: 'py12', warning: null };
  }

  return {
    python: platform === 'win32' ? 'python' : 'python3',
    source: 'fallback',
    warning:
      'the py12 environment was not found, so the interpreter on PATH is being used. ' +
      'Create it with `python -m venv C:\\Python\\pyVenv\\py12`, point PY12_HOME at an ' +
      'existing one, or set SGS_PYTHON to the interpreter you want.',
  };
}

/** The interpreter path alone, for callers that only need the string. */
export function pythonPath(options) {
  return pickPython(options).python;
}

// ---- command form ----------------------------------------------------------
// `node tools/py.mjs <args...>` runs those arguments on the resolved interpreter and exits
// with its status, so an npm script never has to name an interpreter itself.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { python, source, warning } = pickPython();
  if (warning) console.error(`\x1b[33mpy12:\x1b[0m ${warning}`);
  if (process.env.SGS_PYTHON_VERBOSE) console.error(`\x1b[2mpython (${source}): ${python}\x1b[0m`);

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(python);
    process.exit(0);
  }
  const run = spawnSync(python, args, { stdio: 'inherit' });
  if (run.error) {
    console.error(`\x1b[31mcannot run\x1b[0m ${python}: ${run.error.message}`);
    process.exit(1);
  }
  process.exit(run.status ?? 1);
}
