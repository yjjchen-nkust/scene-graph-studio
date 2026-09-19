#!/usr/bin/env node
/**
 * NFR-8, made runnable: `npm run check:perf`.
 *
 * The other two arranged checks each exist because the condition they need is not the condition
 * a developer's machine is in. This one exists for the opposite reason: it needs the machine to
 * be at its *most* complete, because four of the eight labs fetch a frame and a lab rendering
 * its failure sentence cannot be timed. `playwright test` starts no backend on purpose —
 * `lecture.spec.ts` and `projector.spec.ts` are assertions about offline completeness, and a
 * backend running underneath them would weaken what they prove. So the backend is started here,
 * against the repository's own `data/`, and this file is excluded from the default run.
 *
 * Usage:
 *   node tools/perf_check.mjs [--python <interpreter>] [--port <n>]
 *
 * What it does not do: throttle the CPU or the network. The number it produces is this machine's,
 * and `docs/VERIFICATION.md` §10 records which machine that was. D-02 makes the weaker ARM64 box
 * the ship target, and the honest way to cover it is to run this there, not to simulate it here.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { pythonPath } from './py.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
// Same resolution as `offline_check.mjs`: the backend is spawned with `cwd: 'backend'`, so a
// relative interpreter path would be resolved one directory too deep. A bare name is a PATH
// lookup and stays as it is.
// With no `--python`, the project interpreter (py12) is used, so the measured number belongs to
// a named environment rather than to whichever interpreter the shell happened to expose.
const PYTHON = (() => {
  const value = flag('--python', pythonPath());
  return /[\\/]/.test(value) ? resolve(value) : value;
})();
const PORT = flag('--port', '8112');

function die(message, hint) {
  console.error(`\nperf check: ${message}`);
  if (hint) console.error(hint);
  process.exit(1);
}

console.log('perf check — NFR-8');
console.log(`  backend  : ${PYTHON} -m uvicorn on 127.0.0.1:${PORT}, against the repository data/`);

const backend = spawn(
  PYTHON,
  ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', PORT, '--log-level', 'warning'],
  { cwd: 'backend', env: process.env, stdio: 'inherit' },
);

let stopped = false;
function stop() {
  if (stopped) return;
  stopped = true;
  backend.kill();
}
process.on('exit', stop);
process.on('SIGINT', () => process.exit(130));

await new Promise((resolve, reject) => {
  const started = Date.now();
  const poll = setInterval(async () => {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (r.ok) {
        clearInterval(poll);
        resolve(await r.json());
      }
    } catch {
      if (Date.now() - started > 30_000) {
        clearInterval(poll);
        reject(new Error('the backend did not start within 30s'));
      }
    }
  }, 300);
})
  .then((health) => {
    // Printed, not asserted. Whether `torch` is present changes which models L4 offers a live
    // run for, and a number read later without knowing that is a number without its conditions.
    console.log(`  health   : torch_present ${health.torch_present}`);
  })
  .catch((error) => {
    stop();
    die(error.message);
  });

// `node node_modules/@playwright/test/cli.js` rather than `npx playwright`, for the same reason
// `offline_check.mjs` gives: Node will not spawn a `.cmd` without a shell.
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const playwright = spawnSync(process.execPath, [cli, 'test', 'e2e/perf.spec.ts'], {
  env: { ...process.env, SGS_BACKEND_PORT: PORT, SGS_PERF: '1' },
  stdio: 'inherit',
});
if (playwright.error) {
  stop();
  die(`could not run Playwright: ${playwright.error.message}`);
}

stop();
process.exit(playwright.status ?? 1);
