import type { ComponentType } from 'react';
import { Traditional } from './DT/Traditional';

/**
 * Every demonstration, keyed by its id, as `playgrounds/mounts.tsx` keys the playgrounds.
 *
 * A demo always spans consecutive steps, so `part` is always given. Task 8 of the M0 demos plan
 * registered `DT`; Task 9 registers `DV`.
 *
 * `content_lint.mjs` reads the three tables below as text, one entry to a line: two spaces, the
 * id, a colon, the value, a comma. Keep that form.
 */
export type DemoProps = { part: number };

export const DEMO_MOUNTS: Record<string, ComponentType<DemoProps>> = {
  DT: Traditional,
};

/** How many consecutive steps each demo spans: D-T four, D-V five (spec 2026-09-29-m0-demos-design §4). */
export const DEMO_PARTS: Record<string, number> = {
  DT: 4,
  DV: 5,
};

/** The recorded artefact each demo replays, relative to `data/`; the lint requires its provenance. */
export const DEMO_ARTEFACTS: Record<string, string> = {
  DT: 'demos/m0/traditional.json',
  DV: 'demos/m0/indvissgg.json',
};
