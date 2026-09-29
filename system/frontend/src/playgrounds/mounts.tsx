import type { ComponentType } from 'react';
import { MatchRelation } from './E1/MatchRelation';
import { ProtocolSpaces } from './E10/ProtocolSpaces';
import { MaskPairing } from './E13/MaskPairing';
import { TopK } from './E3/TopK';
import { ConstraintModes } from './E4/ConstraintModes';
import { PerPairCap } from './E7/PerPairCap';
import { LabelsToStructure } from './F1/LabelsToStructure';
import { TripletCombinatorics } from './F2/TripletCombinatorics';
import { BoxOverlap } from './F3/BoxOverlap';
import { PredicateSynonymy } from './F6/PredicateSynonymy';
import { LongTailDistribution } from './F7/LongTailDistribution';
import { DirectedEdges } from './F8/DirectedEdges';
import { PairsAgainstRelations } from './T1/PairsAgainstRelations';
import { BeliefsUnderAveraging } from './T2/BeliefsUnderAveraging';
import { SplitReleases } from './X1/SplitReleases';
import { VrdPerPair } from './X2/VrdPerPair';

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
  E1: MatchRelation,
  E10: ProtocolSpaces,
  E13: MaskPairing,
  E3: TopK,
  E4: ConstraintModes,
  E7: PerPairCap,
  F1: LabelsToStructure,
  F2: TripletCombinatorics,
  F3: BoxOverlap,
  F6: PredicateSynonymy,
  F7: LongTailDistribution,
  F8: DirectedEdges,
  T1: PairsAgainstRelations,
  T2: BeliefsUnderAveraging,
  X1: SplitReleases,
  X2: VrdPerPair,
};

export const PLAYGROUND_IDS: string[] = Object.keys(PLAYGROUND_MOUNTS).sort();

/**
 * The playgrounds too long for one panel, and how many consecutive steps each spans.
 *
 * At 1024×768 a step shows 561 px, and each of these eleven is taller than that by its frame alone
 * (D96). A point absent here is one step. `content_lint.mjs` reads this table as it reads the one
 * above, and refuses a step naming a part the table does not give.
 */
export const PLAYGROUND_PARTS: Record<string, number> = {
  E1: 2,
  E10: 2,
  E3: 2,
  E4: 2,
  E7: 2,
  F1: 2,
  F3: 2,
  F6: 2,
  F7: 2,
  T2: 2,
  X1: 3,
};
