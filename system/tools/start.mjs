// One command to run the application: `npm start`.
//
// Starts the FastAPI backend and the Vite dev server together, checks the things that
// actually go wrong before starting either, and shuts both down cleanly on Ctrl+C.
//
// The checks are not ceremony. Each one corresponds to a way a first run has already failed:
// a Node too old for Vite, a Python environment without FastAPI, a clone with no placeholder
// slice, or a port still held by a previous run.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { pickPython } from './py.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// data/ and docs/ stayed at the track root when the machinery moved under system/.
const TRACK = join(ROOT, '..');
// Overridable, because a port collision with something unrelated is one of the commonest
// ways a first run fails and the student has no way to move our ports otherwise.
const BACKEND_PORT = Number(process.env.SGS_BACKEND_PORT ?? 8000);
const FRONTEND_PORT = Number(process.env.SGS_FRONTEND_PORT ?? 5173);
// The interpreter is resolved in one place for the whole project (tools/py.mjs): SGS_PYTHON,
// then an activated py12, then py12 on disk, then PATH with a warning.
const { python: PYTHON, source: PYTHON_SOURCE, warning: PYTHON_WARNING } = pickPython();

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  amber: (s) => `\x1b[33m${s}\x1b[0m`,
};

function die(what, fix) {
  console.error(`\n${c.red('cannot start')}  ${what}`);
  console.error(`${c.dim('  fix:')} ${fix}\n`);
  process.exit(1);
}

function portFree(port) {
  return new Promise((resolve) => {
    const s = createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '127.0.0.1');
  });
}

// ---- preflight -------------------------------------------------------------

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  die(
    `Node ${process.versions.node} is too old; Vite needs ^20.19 or >=22.12`,
    'winget install --id OpenJS.NodeJS.LTS -e   (then reopen the terminal)',
  );
}

if (PYTHON_WARNING) console.log(c.amber(`py12: ${PYTHON_WARNING}`));
console.log(c.dim(`python (${PYTHON_SOURCE}): ${PYTHON}`));

const py = spawnSync(PYTHON, ['-c', 'import fastapi, uvicorn, pydantic, PIL'], { cwd: ROOT });
if (py.status !== 0) {
  die(
    `${PYTHON} cannot import the backend dependencies`,
    'node tools/py.mjs -m pip install -r backend/requirements.txt   ' +
      '(or set SGS_PYTHON to the interpreter that has them)',
  );
}

if (!existsSync(join(ROOT, 'node_modules'))) {
  die('node_modules is missing', 'npm install');
}

if (!existsSync(join(TRACK, 'data/slices/placeholder/annotations.json'))) {
  console.log(c.amber('placeholder slice missing; generating it'));
  const made = spawnSync(PYTHON, ['backend/scripts/make_placeholders.py'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (made.status !== 0) die('could not generate the placeholder slice', 'see the error above');
}

for (const [port, who] of [
  [BACKEND_PORT, 'the backend'],
  [FRONTEND_PORT, 'the dev server'],
]) {
  if (!(await portFree(port))) {
    die(
      `port ${port} is already in use, so ${who} cannot bind it`,
      `stop whatever holds it (netstat -ano | findstr :${port}), or pick another:
` +
        `       SGS_BACKEND_PORT=8010 SGS_FRONTEND_PORT=5180 npm start`,
    );
  }
}

// ---- start -----------------------------------------------------------------

const children = [];

function start(name, command, args, extraEnv = {}, cwd = ROOT) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const tag = c.dim(`[${name}]`);
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf-8');
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) console.log(`${tag} ${line}`);
    });
  }
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`\n${c.red(`${name} exited with code ${code}`)}`);
      shutdown(code ?? 1);
    }
  });
  children.push(child);
  return child;
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try {
      child.kill();
    } catch {
      // Already gone.
    }
  }
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

start('backend', PYTHON, [
  '-m',
  'uvicorn',
  'app.main:app',
  '--app-dir',
  'backend',
  '--host',
  '127.0.0.1',
  '--port',
  String(BACKEND_PORT),
  '--reload',
]);

// Vite's own bin, run with this Node, rather than `npm run dev`. On Windows npm is a .cmd
// shim, which Node 24 refuses to spawn without a shell (EINVAL) and Node 22 deprecates
// spawning with one. A .js entry point sidesteps both and removes a process from the tree.
const VITE_BIN = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
if (!existsSync(VITE_BIN)) die('vite is not installed', 'npm install');
start(
  'frontend',
  process.execPath,
  [VITE_BIN, '--port', String(FRONTEND_PORT), '--strictPort'],
  // Vite proxies /api to the backend, so the port override has to reach its config too.
  { SGS_BACKEND_PORT: String(BACKEND_PORT) },
  join(ROOT, 'frontend'),
);

// ---- report once both answer ----------------------------------------------

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json().catch(() => ({}));
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

const health = await waitFor(`http://127.0.0.1:${BACKEND_PORT}/api/health`, 30_000);
const frontendUp = await waitFor(`http://127.0.0.1:${FRONTEND_PORT}/`, 30_000) !== null
  || (await fetch(`http://127.0.0.1:${FRONTEND_PORT}/`).then((r) => r.ok).catch(() => false));

console.log('');
if (health) {
  const slices = Object.entries(health.slices_present ?? {})
    .filter(([, present]) => present)
    .map(([ds]) => ds);
  console.log(`  ${c.green('●')} ${c.bold('Scene Graph Studio')}`);
  console.log(`    open      ${c.bold(`http://127.0.0.1:${FRONTEND_PORT}/`)}`);
  console.log(`    api       http://127.0.0.1:${BACKEND_PORT}/api/health`);
  console.log(`    torch     ${health.torch_present ? health.torch_version : 'not installed'}`);
  console.log(`    device    ${health.device}`);
  console.log(`    slices    ${slices.length ? slices.join(', ') : 'none unpacked'}`);
  if (slices.length === 1 && slices[0] === 'placeholder') {
    console.log(
      c.dim(
        '    Only the placeholder slice is present. That is enough for every lab.\n' +
          '    For the real slices, unpack the course bundle into data/slices/ and run\n' +
          '    python backend/scripts/verify_bundle.py',
      ),
    );
  }
} else {
  console.log(c.red('  the backend did not answer within 30s; see the [backend] lines above'));
}
if (!frontendUp) {
  console.log(c.amber('  the dev server did not answer; see the [frontend] lines above'));
}
console.log(c.dim('\n  Ctrl+C stops both.\n'));
