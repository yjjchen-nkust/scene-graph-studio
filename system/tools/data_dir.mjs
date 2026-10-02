// Where the tools find data/, and the stop when it is absent (D125).
import { statSync } from 'node:fs';

/**
 * data/, as the tools read it from system/: the track root's `data`, or `SGS_DATA_DIR`, which
 * moves the backend's `DATA_DIR` too, so one variable moves both.
 */
export const DATA_DIR = process.env.SGS_DATA_DIR ?? '../data';

/**
 * `dir`, for a tool about to write under it, or an error that names the remedy.
 *
 * data/ is the link to the NAS that `devdata pull` makes (D110, D125). A writer that ran without it
 * would create a real directory in its place, which devdata reports as `occupied`, and what it
 * wrote would reach no NAS and no other checkout: rule 10.4 of the devdata spec.
 * `app.settings.require_data_dir` is the backend's copy of this rule.
 */
export function requireDataDir(dir = DATA_DIR) {
  let present = false;
  try {
    present = statSync(dir).isDirectory();
  } catch {
    present = false;
  }
  if (!present) {
    throw new Error(
      `${dir} is absent. data/ is the link to the NAS that \`devdata pull\` makes; run ` +
        '`devdata pull` at the track root (or set SGS_DATA_DIR). Nothing was written.',
    );
  }
  return dir;
}
