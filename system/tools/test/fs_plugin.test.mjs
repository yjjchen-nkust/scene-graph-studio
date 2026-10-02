import { describe, expect, it } from 'vitest';
import { byteRange, servableAcrossDrives } from '../../fs.plugin.ts';

/**
 * Which `/@fs/` requests the cross-drive plugin answers, and which it leaves to Vite.
 *
 * It answers only what Vite cannot: a file on another drive than the server's, inside
 * `server.fs.allow`. Everything else goes on to Vite, which serves its own drive and refuses
 * what lies outside the list, so the plugin widens nothing Vite would refuse.
 */
const ALLOW = ['C:/dev/WekaExt/scene-graph-studio/system', 'D:/nas/scene-graph'];

describe('servableAcrossDrives', () => {
  it('answers a file on another drive inside the allow list, as a path on that drive', () => {
    expect(servableAcrossDrives('/@fs/D:/nas/scene-graph/demos/m0/clip.mp4', ALLOW, 'C:'))
      .toBe('D:/nas/scene-graph/demos/m0/clip.mp4');
  });

  it('leaves a file on the server\'s own drive to Vite, which serves it', () => {
    expect(servableAcrossDrives('/@fs/C:/dev/WekaExt/scene-graph-studio/system/package.json', ALLOW, 'C:'))
      .toBeNull();
  });

  it('leaves a file outside the allow list to Vite, which refuses it', () => {
    expect(servableAcrossDrives('/@fs/D:/nas/other/secret.json', ALLOW, 'C:')).toBeNull();
    // A sibling whose name only begins like an allowed directory is outside it.
    expect(servableAcrossDrives('/@fs/D:/nas/scene-graph-old/a.json', ALLOW, 'C:')).toBeNull();
  });

  it('resolves dot segments before it compares, so a climb out of the list is refused', () => {
    expect(servableAcrossDrives('/@fs/D:/nas/scene-graph/../other/secret.json', ALLOW, 'C:'))
      .toBeNull();
    expect(servableAcrossDrives('/@fs/D:/nas/scene-graph/%2E%2E/other/secret.json', ALLOW, 'C:'))
      .toBeNull();
  });

  it('reads the path decoded, and compares drive and case as Windows does', () => {
    expect(servableAcrossDrives('/@fs/d:/NAS/Scene-Graph/frames/a%20b.jpg', ALLOW, 'c:'))
      .toBe('d:/NAS/Scene-Graph/frames/a b.jpg');
  });

  it('leaves every request with a query to Vite, which transforms modules and reads across drives', () => {
    // `leaderboards.json?import` is a module, and served raw the page loaded none of its JSON
    // and rendered blank (measured 2026-10-02). An <img> or a <video> asks with no query.
    for (const query of ['?import', '?import&t=1700000000000', '?url', '?raw', '?t=1']) {
      expect(servableAcrossDrives(`/@fs/D:/nas/scene-graph/content/leaderboards.json${query}`, ALLOW, 'C:'), query)
        .toBeNull();
    }
  });

  it('ignores every request that is not a /@fs/ path with a drive', () => {
    for (const url of ['/', '/src/main.tsx', '/@fs/home/user/a.json', '/@vite/client']) {
      expect(servableAcrossDrives(url, ALLOW, 'C:'), url).toBeNull();
    }
  });
});

describe('byteRange', () => {
  it('serves the whole file when no range is asked for', () => {
    expect(byteRange(undefined, 1000)).toEqual({ start: 0, end: 999, partial: false });
  });

  it('reads an open, a closed and a suffix range, as a video element asks for them', () => {
    expect(byteRange('bytes=0-', 1000)).toEqual({ start: 0, end: 999, partial: true });
    expect(byteRange('bytes=100-199', 1000)).toEqual({ start: 100, end: 199, partial: true });
    expect(byteRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999, partial: true });
    expect(byteRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999, partial: true });
  });

  it('refuses a range that starts past the end or runs backwards', () => {
    expect(byteRange('bytes=1000-', 1000)).toBeNull();
    expect(byteRange('bytes=500-100', 1000)).toBeNull();
  });
});
