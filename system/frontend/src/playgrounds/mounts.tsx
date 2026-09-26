import type { ComponentType } from 'react';
import { LabelsToStructure } from './F1/LabelsToStructure';
import { TripletCombinatorics } from './F2/TripletCombinatorics';
import { BoxOverlap } from './F3/BoxOverlap';
import { PredicateSynonymy } from './F6/PredicateSynonymy';
import { LongTailDistribution } from './F7/LongTailDistribution';
import { DirectedEdges } from './F8/DirectedEdges';
import { SplitReleases } from './X1/SplitReleases';

/**
 * Every playground, keyed by the knowledge point it demonstrates.
 *
 * One table, and `PLAYGROUND_IDS` derived from it rather than written beside it, so a component
 * without an entry cannot appear and an entry without a component cannot be missed.
 * `labs/mounts.tsx` is keyed by lab id for the same reason.
 *
 * Entries are added by the task that builds each playground.
 */
/** `part` is one view of a playground split across steps; absent, the playground is whole. */
export type PlaygroundProps = { part?: number };

export const PLAYGROUND_MOUNTS: Record<string, ComponentType<PlaygroundProps>> = {
  F1: LabelsToStructure,
  F2: TripletCombinatorics,
  F3: BoxOverlap,
  F6: PredicateSynonymy,
  F7: LongTailDistribution,
  F8: DirectedEdges,
  X1: SplitReleases,
};

export const PLAYGROUND_IDS: string[] = Object.keys(PLAYGROUND_MOUNTS).sort();

/**
 * The playgrounds too long for one panel, and how many consecutive steps each spans.
 *
 * At 1024×768 a step shows 561 px, and each of these four is taller than that by its frame alone
 * (D96). A point absent here is one step. `content_lint.mjs` reads this table as it reads the one
 * above, and refuses a step naming a part the table does not give.
 */
export const PLAYGROUND_PARTS: Record<string, number> = {
  F1: 2,
  F6: 2,
  F7: 2,
  X1: 3,
};
