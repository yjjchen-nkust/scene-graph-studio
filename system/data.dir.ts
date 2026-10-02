import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Where the track's data/ really is, for the test run's filesystem guard.
 *
 * data/ is a link to the NAS (D110), and Vite's filesystem guard checks the real path of every
 * file it imports, so an allow list naming data/ alone denies each file in it: every suite that
 * imports from it failed to collect on "Denied ID <the link's real target>/…". When the link does not
 * resolve, its own path comes back, so a clone with no data/ fails on the missing file it
 * imports rather than here.
 */
export function dataDirectory(): string {
  const link = fileURLToPath(new URL('../data', import.meta.url));
  try {
    return realpathSync(link);
  } catch {
    return link;
  }
}
