import type { ReportedConstraint, ReportedProtocol } from 'sgg-metrics';
import raw from '../../../../data/content/leaderboards.json';

export interface LeaderboardRow {
  paper_key: string;
  /**
   * `null` means the source does not state it. Contracts §3.3 types all three as `string` on the
   * strength of PRD §6.4's "names the detector backbone, the codebase, and the epoch budget", but
   * no source this project has opened states a codebase or an epoch budget for any row, and only
   * IndVisSGG states a backbone, and only for its own. The requirement is met where it can be
   * met — by the banner, which names all three axes — and null says the rest plainly. D35.
   */
  detector_backbone: string | null;
  codebase: string | null;
  epoch_budget: string | null;
  values: Array<{ metric: 'R' | 'mR' | 'ngR' | 'zR'; k: number; value: number; verified: boolean }>;
}

export interface Leaderboard {
  id: string;
  title_en: string;
  title_zh: string;
  dataset: string;
  protocol: ReportedProtocol;
  constraint: ReportedConstraint;
  /** The paper the table sits in, and the table. Part of the board's identity, not a footnote. */
  source: string;
  source_table: string;
  banner_en: string;
  banner_zh: string;
  rows: LeaderboardRow[];
  dead_leaderboard_notice_en: string;
  dead_leaderboard_notice_zh: string;
}

/**
 * The frozen boards, one per (source, source_table, dataset).
 *
 * Contracts §3.3 keys a board on (dataset, protocol, constraint). That is one field short: this
 * corpus holds VG-150 PredCls mR@100 for FREQ at 16.0 from Tang et al.'s Table 1 and at 15.8 from
 * KERN's, under identical protocol and constraint. Keyed the contract's way they would share a
 * board and a column, which is the merged ranking PRD §6.4 exists to forbid. D35.
 *
 * There is no function here that takes two boards. That absence is the enforcement.
 */
export const BOARDS = raw as Leaderboard[];
