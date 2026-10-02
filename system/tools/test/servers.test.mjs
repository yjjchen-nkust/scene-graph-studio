import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { PREVIEW_PORT, holderCommand, portFree, refusePorts, stopTree, treeKillCommand } from '../servers.mjs';

/**
 * How the tools stop the servers they start, and how they refuse a port someone else holds.
 *
 * `start.mjs` stopped the backend with `child.kill()`, which on Windows ends one process. The
 * backend is three: py12's `python.exe` is a venv launcher that runs the real interpreter as its
 * child, and `uvicorn --reload` runs its server as a child of that. Measured on 2026-10-01 with
 * `start.mjs` on ports 8031 and 5191: after its own shutdown, 8031 still answered, held by the
 * interpreter whose launcher was the one process killed. `offline_check.mjs` and `perf_check.mjs`
 * stop theirs the same way and started on fixed ports without asking whether they were free.
 *
 * Nothing here starts a real server. The tree test runs on Windows only, where the defect is; a
 * POSIX `kill` reaches the interpreter itself, and uvicorn's reloader passes SIGTERM to its worker.
 */

const SYSTEM = resolve(import.meta.dirname, '../..');
const held = [];
const children = [];

/** A server holding `port` on `host` that answers nothing, or an ephemeral port when 0. */
async function hold(host = '127.0.0.1', port = 0) {
  const server = createServer((socket) => socket.destroy());
  await new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(port, host, done);
  });
  held.push(server);
  return server.address().port;
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function until(predicate, ms) {
  const deadline = Date.now() + ms;
  while (!predicate() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
}

afterEach(async () => {
  await Promise.all(held.splice(0).map((s) => new Promise((done) => s.close(done))));
  for (const pid of children.splice(0)) if (alive(pid)) process.kill(pid);
});

describe('stopping a server the tools started', () => {
  it('ends the whole tree on Windows with taskkill, and leaves POSIX to kill', () => {
    expect(treeKillCommand(4321, 'win32')).toEqual(['taskkill', ['/pid', '4321', '/T', '/F']]);
    expect(treeKillCommand(4321, 'linux')).toBeNull();
    expect(treeKillCommand(4321, 'darwin')).toBeNull();
  });

  it.skipIf(process.platform !== 'win32')(
    'ends the grandchild of the process it was given, which kill() alone leaves running',
    async () => {
      // A parent that starts a child and prints its pid: py12's launcher over the interpreter,
      // and uvicorn's reloader over its worker, have this shape. `detached`, because Node puts the
      // children it spawns in a job object that ends them with it, and neither Python parent
      // does; without it the grandchild died with its parent under `kill()` too, and this test
      // passed against the defect it is for.
      const parent = spawn(process.execPath, ['-e', [
        "const c = require('node:child_process').spawn(process.execPath,",
        "  ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', detached: true });",
        'console.log(c.pid);',
        'setInterval(() => {}, 1000);',
      ].join('\n')], { stdio: ['ignore', 'pipe', 'inherit'] });
      children.push(parent.pid);
      const grandchild = Number(await new Promise((done) => parent.stdout.once('data', (d) => done(String(d)))));
      children.push(grandchild);
      expect(alive(grandchild)).toBe(true);

      stopTree(parent);
      await until(() => !alive(grandchild), 5_000);
      expect(alive(grandchild), `pid ${grandchild} outlived its parent's stop`).toBe(false);
    },
    15_000,
  );

  it('does nothing to a process that has already exited, however often it is asked', async () => {
    const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
    await new Promise((done) => child.once('exit', done));
    expect(() => {
      stopTree(child);
      stopTree(child);
    }).not.toThrow();
  });
});

describe('refusing a port someone else holds', () => {
  it('reads a port held on 127.0.0.1 as taken, and free once it is let go', async () => {
    const port = await hold('127.0.0.1');
    expect(await portFree(port)).toBe(false);
    await new Promise((done) => held.pop().close(done));
    expect(await portFree(port)).toBe(true);
  });

  it('reads a port held on every interface as taken, which a bind on 127.0.0.1 alone does not see', async () => {
    // On Windows a bind to 127.0.0.1 succeeds beside a listener on 0.0.0.0 or ::, and a request
    // to 127.0.0.1 is still answered by that listener, so the probe also tries to connect.
    for (const host of ['0.0.0.0', '::']) {
      // A runner without IPv6 cannot hold `::`, and has nothing there to be fooled by.
      const port = await hold(host).catch((e) => (host === '::' ? null : Promise.reject(e)));
      if (port !== null) expect(await portFree(port), `${host}:${port}`).toBe(false);
    }
  });

  it('names the port, what it is for, how to find its holder and how to move it', async () => {
    const port = await hold();
    const free = await hold();
    await new Promise((done) => held.pop().close(done));
    const needs = [
      { port, role: 'the backend cannot bind it', move: '--port <n>' },
      { port: free, role: 'unused here', move: '--other <n>' },
    ];
    const windows = await refusePorts(needs, 'win32');
    expect(windows).toContain(`port ${port} is in use, so the backend cannot bind it`);
    expect(windows).toContain(`netstat -ano | findstr :${port}`);
    expect(windows).toContain('taskkill /pid <pid> /T /F');
    expect(windows).toContain('--port <n>');
    expect(windows).not.toContain(`port ${free}`);
    const linux = await refusePorts(needs, 'linux');
    expect(linux).toContain(holderCommand(port, 'linux'));
    expect(linux).not.toContain('netstat');
    expect(await refusePorts([{ port: free, role: 'x' }])).toBeNull();
  });

  it('says a port cannot be moved when nothing moves it', async () => {
    const port = await hold();
    const message = await refusePorts([{ port, role: 'Playwright cannot start the preview server' }], 'win32');
    expect(message).toContain('fixed in playwright.config.ts');
  });

  it('agrees with playwright.config.ts on the preview port', () => {
    // The config is the preview port's one statement; the checks restate it to test it before
    // they start, so the two are held together here.
    const config = readFileSync(join(SYSTEM, 'playwright.config.ts'), 'utf-8');
    const stated = [...config.matchAll(/127\.0\.0\.1:(\d+)|--port (\d+)/g)].map((m) => Number(m[1] ?? m[2]));
    expect(stated.length).toBeGreaterThanOrEqual(3);
    expect(new Set(stated)).toEqual(new Set([PREVIEW_PORT]));
  });
});

describe('the checks refuse a taken port before they start anything', () => {
  // The interpreter does not exist, so a check that gets past its port test fails on the
  // interpreter instead, and no backend or Playwright run can start either way.
  const NO_PYTHON = join(tmpdir(), 'sgs-no-such-python', 'python');
  const run = (script, port) =>
    spawnSync(process.execPath, [`tools/${script}`, '--port', String(port), '--python', NO_PYTHON], {
      cwd: SYSTEM, encoding: 'utf-8', timeout: 20_000,
    });

  for (const script of ['offline_check.mjs', 'perf_check.mjs']) {
    it(`${script} names a backend port someone else holds, and starts nothing`, async () => {
      const port = await hold();
      const r = run(script, port);
      const out = `${r.stdout}${r.stderr}`;
      expect(r.status, out).toBe(1);
      expect(out).toContain(`port ${port} is in use`);
      expect(out).toContain('--port');
      expect(out).not.toMatch(/ENOENT|could not run|did not start/);
    }, 30_000);
  }

  it('perf_check.mjs refuses a port that is not a port', () => {
    const r = run('perf_check.mjs', 'eighty');
    expect(r.status).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain("--port 'eighty' is not a port number");
  });
});
