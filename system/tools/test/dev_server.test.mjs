import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The dev server, started from `frontend/vite.config.ts` as `npm start` starts it, asked for what
 * the pages import from `data/`.
 *
 * `data/` is a sibling of `system/`, and a link whose real path is elsewhere (D110), and Vite
 * serves a file outside `server.fs.allow` as the application's `index.html` with status 200. A
 * `<video>` handed that HTML reports a demuxer error, an `<img>` a broken image, and nothing in
 * the terminal says why: D-T's and D-V's clip and every playground photograph failed so under
 * `npm start` while the build, which bundles them, showed them all (measured 2026-10-02).
 */

const FRONTEND = resolve(import.meta.dirname, '../../frontend');
const DATA = realpathSync(resolve(import.meta.dirname, '../../../data'));

let server;
let origin;

beforeAll(async () => {
  // Port 0, because the author's own dev server may hold 5173 while this runs.
  server = await createServer({
    configFile: resolve(FRONTEND, 'vite.config.ts'),
    root: FRONTEND,
    logLevel: 'silent',
    server: { port: 0, strictPort: false, hmr: false },
  });
  await server.listen();
  const address = server.httpServer.address();
  origin = `http://127.0.0.1:${address.port}`;
}, 60_000);

afterAll(async () => {
  await server?.close();
});

/** The URL Vite writes for a file outside its root: `/@fs/` and the real path, forward slashes. */
const fsUrl = (relative) => `${origin}/@fs/${resolve(DATA, relative).replaceAll('\\', '/').replace(/^\//, '')}`;

describe('the dev server serves what the pages import from data/', () => {
  it("serves D-T's and D-V's clip as a video, not as the application's page", async () => {
    const response = await fetch(fsUrl('demos/m0/clip.mp4'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^video\/mp4/);
  });

  it('answers the ranges a <video> reads its file in', async () => {
    const response = await fetch(fsUrl('demos/m0/clip.mp4'), { headers: { Range: 'bytes=0-99' } });
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toMatch(/^bytes 0-99\/\d+$/);
    expect((await response.arrayBuffer()).byteLength).toBe(100);
  });

  it('still answers a JSON module from data/ as JavaScript, which Vite transforms', async () => {
    const response = await fetch(`${fsUrl('content/leaderboards.json')}?import`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/javascript/);
  });

  it('serves a demo frame and a playground photograph as images', async () => {
    for (const file of ['demos/m0/frames/m0-demo-088.jpg', 'slices/placeholder/images/ph-001.png']) {
      const response = await fetch(fsUrl(file));
      expect(response.status, file).toBe(200);
      expect(response.headers.get('content-type'), file).toMatch(/^image\//);
    }
  });
});
