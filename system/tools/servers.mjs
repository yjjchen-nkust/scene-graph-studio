// The servers the tools start: how they are stopped, and how a port someone else holds is refused.
//
// Three tools start a backend -- start.mjs, offline_check.mjs and perf_check.mjs -- and until
// 2026-10-01 each stopped it with `child.kill()`, and the two checks started on fixed ports
// without asking whether anything held them. Both defects are this file's, so the three share it.
import { spawnSync } from 'node:child_process';
import { connect, createServer } from 'node:net';

/**
 * The port `vite preview` serves the production build on for Playwright. playwright.config.ts
 * states it and cannot be overridden from outside; the checks restate it here only to test it
 * before they start, and `tools/test/servers.test.mjs` holds the two together.
 */
export const PREVIEW_PORT = 4173;

/**
 * The command that ends `pid` and every process under it, or null where `kill()` already does.
 *
 * On Windows `kill()` is TerminateProcess on one process, and the backend is three: py12's
 * `python.exe` is a venv launcher that runs the real interpreter as its child, and
 * `uvicorn --reload` runs its server as a child of that. Neither parent ties its children to its
 * own life, so killing the launcher left the server holding the port (measured on 2026-10-01).
 * `taskkill /T` walks the tree by parent id, so it must run while the launcher is still alive.
 * On POSIX the venv's `python` is the interpreter itself and uvicorn's reloader passes SIGTERM to
 * its worker, so `kill()` stays.
 */
export function treeKillCommand(pid, platform = process.platform) {
  return platform === 'win32' ? ['taskkill', ['/pid', String(pid), '/T', '/F']] : null;
}

const stopped = new WeakSet();

/**
 * Ends `child` and, on Windows, everything it started. Synchronous on purpose: the checks stop
 * their backend from a `process.on('exit')` handler, where nothing awaited would run. Asking twice
 * is harmless, since both checks stop on their way out and again on exit.
 */
export function stopTree(child, { platform = process.platform } = {}) {
  if (stopped.has(child)) return;
  stopped.add(child);
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  const command = treeKillCommand(child.pid, platform);
  if (command && spawnSync(command[0], command[1], { stdio: 'ignore', windowsHide: true }).status === 0) return;
  try {
    child.kill();
  } catch {
    // Already gone.
  }
}

/**
 * Whether nothing holds `port` on `host`: a server can bind it, and nothing answers there.
 *
 * Binding alone is not enough on Windows. A bind to 127.0.0.1 succeeds beside another process
 * listening on 0.0.0.0 or ::, and a request to 127.0.0.1 is then answered by that process
 * (measured on 2026-10-01), which is how a check reads someone else's backend as its own.
 */
export async function portFree(port, host = '127.0.0.1') {
  const bindable = await new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, host);
  });
  if (!bindable) return false;
  const answered = await new Promise((resolve) => {
    const socket = connect(port, host);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
  return !answered;
}

/** How to see what holds `port`. */
export function holderCommand(port, platform = process.platform) {
  return platform === 'win32' ? `netstat -ano | findstr :${port}` : `lsof -nP -iTCP:${port} -sTCP:LISTEN`;
}

/**
 * The message refusing every port of `needs` that is taken, or null when all are free.
 *
 * `needs` is `{ port, role, move }`: `role` finishes "port N is in use, so …", and `move` is the
 * flag that puts the server elsewhere. A need with no `move` is the preview port, which only
 * playwright.config.ts can move.
 */
export async function refusePorts(needs, platform = process.platform) {
  const free = await Promise.all(needs.map(({ port }) => portFree(port)));
  const taken = needs.filter((_, i) => !free[i]);
  if (taken.length === 0) return null;
  const end = platform === 'win32' ? 'taskkill /pid <pid> /T /F' : 'kill <pid>';
  return taken.map(({ port, role, move }) => [
    `port ${port} is in use, so ${role}.`,
    `  see what holds it : ${holderCommand(port, platform)}`,
    `  then end it       : ${end}, if it is yours`,
    move ? `  or move this one  : ${move}` : '  it cannot be moved: the port is fixed in playwright.config.ts',
  ].join('\n')).join('\n');
}

/** A `--port` value as a port number, or null when it is not one. */
export function parsePort(text) {
  const port = Number(text);
  return /^\d+$/.test(String(text)) && port >= 1 && port <= 65535 ? port : null;
}
