import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, posix } from 'node:path';
import type { Plugin } from 'vite';

/**
 * The files the pages import from data/, by extension. Anything else is octet-stream: the
 * plugin serves what the pages embed, and a page embeds no other kind.
 */
const TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json',
};

/**
 * The file a `/@fs/` request names, when it lies on another drive than the server's and inside
 * `allow`; otherwise null, and the request goes on to Vite.
 *
 * Only a request with no query is a file: `?import`, `?url`, `?raw` and `?t=` are Vite's module
 * requests, which its transform middleware answers and reads across drives correctly, and a JSON
 * module answered raw here left the page blank. The path is decoded and its dot segments
 * resolved before it is compared, so `..` cannot climb out of the list. Drive letters and case
 * are compared as Windows compares them.
 */
export function servableAcrossDrives(
  url: string,
  allow: readonly string[],
  serverDrive: string,
): string | null {
  const match = /^\/@fs\/([a-z]:\/[^?#]*)$/i.exec(url);
  if (!match) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
  const file = posix.normalize(decoded);
  if (file.slice(0, 2).toLowerCase() === serverDrive.toLowerCase()) return null;
  const folded = file.toLowerCase();
  const inside = allow.some((dir) => {
    const root = dir.replace(/\/+$/, '').toLowerCase();
    return folded === root || folded.startsWith(`${root}/`);
  });
  return inside ? file : null;
}

/**
 * The bytes a `Range` header asks for, in the single-range form a `<video>` sends, or null when
 * the range cannot be satisfied. No header, or one this does not read, is the whole file.
 */
export function byteRange(
  header: string | undefined,
  size: number,
): { start: number; end: number; partial: boolean } | null {
  const range = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!range || (range[1] === '' && range[2] === '')) return { start: 0, end: size - 1, partial: false };
  const [, from, to] = range;
  const start = from === '' ? Math.max(0, size - Number(to)) : Number(from);
  const end = from === '' || to === '' ? size - 1 : Math.min(Number(to), size - 1);
  if (start >= size || start > end) return null;
  return { start, end, partial: true };
}

/**
 * `/@fs/` for a file on another drive than the dev server's, in development only.
 *
 * Vite 8.3.0's own `/@fs/` handler drops the drive letter and reads from the root of the server's
 * drive, so on Windows a file on D: is looked for on C:, is not found, and the request falls
 * through to the application's `index.html` with status 200. data/ is a link to the NAS (D110),
 * whose real path on the author's machine is a folder on D: beside a checkout on
 * C:, so D-T's and D-V's clip reported a demuxer error and every photograph imported from data/
 * was a broken image under `npm start`, while the build, which bundles them, showed them all.
 *
 * The middleware is registered ahead of Vite's own and answers only what Vite cannot: a file on
 * another drive, inside `server.fs.allow`. A path on the server's drive and a path outside the
 * list go on to Vite, which serves the first and refuses the second, so nothing Vite would refuse
 * is served here. Ranges are honoured, because a `<video>` reads its file in them.
 */
export function crossDriveFs(): Plugin {
  return {
    name: 'sgs:cross-drive-fs',
    apply: 'serve',
    configureServer(server) {
      if (process.platform !== 'win32') return;
      const serverDrive = process.cwd().slice(0, 2);
      server.middlewares.use(async (req, res, next) => {
        const file = servableAcrossDrives(req.url ?? '', server.config.server.fs.allow, serverDrive);
        if (!file) return next();
        let size: number;
        try {
          const found = await stat(file);
          if (!found.isFile()) return next();
          size = found.size;
        } catch {
          return next();
        }
        const range = byteRange(req.headers.range, size);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        if (!range) {
          res.statusCode = 416;
          res.setHeader('Content-Range', `bytes */${size}`);
          res.end();
          return;
        }
        res.statusCode = range.partial ? 206 : 200;
        if (range.partial) res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
        res.setHeader('Content-Length', String(range.end - range.start + 1));
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        createReadStream(file, { start: range.start, end: range.end }).pipe(res);
      });
    },
  };
}
