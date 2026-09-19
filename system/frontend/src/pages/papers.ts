import type { ReportedConstraint, ReportedProtocol } from 'sgg-metrics';
import raw from '../../../../data/content/papers.json';

export interface ReportedNumber {
  dataset: string;
  metric: 'R' | 'mR' | 'ngR' | 'zR';
  k: number;
  value: number;
  protocol: ReportedProtocol;
  constraint: ReportedConstraint;
  /**
   * The detector or model the source names for this row, or `null` when it names none. Null is a
   * statement, not a gap: it is what separates IndVisSGG's two ISG rows, one on GPT-4V and one on
   * Gemini-Pro-Vision, and what says that the paper controlled nothing about its baselines.
   */
  backbone: string | null;
  /** The passage that establishes an `unstated` tag, quoted so a reader can check it. */
  protocol_note_en?: string;
  protocol_note_zh?: string;
  /** The paper whose table this was read out of, which need not be the card it sits on. */
  source: string;
  source_table: string;
  verified: boolean;
  note_en?: string;
  note_zh?: string;
}

export interface PaperCardData {
  key: string;
  branch: string;
  year: number;
  venue: string;
  tier: 'A' | 'B';
  module: string | null;
  modules: string[];
  core_idea_en: string;
  core_idea_zh: string;
  predecessor: string | null;
  defect_fixed_en: string | null;
  defect_fixed_zh: string | null;
  caveat_en?: string;
  caveat_zh?: string;
  doi: string | null;
  arxiv: string | null;
  url: string | null;
  reported: ReportedNumber[];
}

export const PAPERS = raw as PaperCardData[];

/**
 * The branches, in the order the curriculum teaches them.
 *
 * `foundations` is a ninth alongside the eight of contracts §3.2, and it holds the datasets:
 * Visual Genome, GQA, Haystack, IndoorVG. They are not methods and belong on no method lineage,
 * but a field map that omits them cannot show where a method's evaluation came from. D33.
 */
export const BRANCHES = [
  'foundations',
  'two-stage',
  'debiasing',
  'one-stage',
  'panoptic',
  'open-vocabulary',
  'llm-vlm',
  'video',
  'embodied',
] as const;

export type Branch = (typeof BRANCHES)[number];

export const BRANCH_LABEL: Record<Branch, { en: string; zh: string }> = {
  foundations: { en: 'Datasets and foundations', zh: '資料集與基礎' },
  'two-stage': { en: 'Two-stage', zh: '兩階段' },
  debiasing: { en: 'Debiasing', zh: '去偏' },
  'one-stage': { en: 'One-stage', zh: '單階段' },
  panoptic: { en: 'Panoptic', zh: '全景' },
  'open-vocabulary': { en: 'Open vocabulary', zh: '開放詞彙' },
  'llm-vlm': { en: 'LLM and VLM', zh: 'LLM 與 VLM' },
  video: { en: 'Video', zh: '影片' },
  embodied: { en: '3D and embodied', zh: '3D 與具身' },
};

export function byKey(key: string): PaperCardData | undefined {
  return PAPERS.find((p) => p.key === key);
}

/** Datasets a card reports numbers on, for the field map's dataset filter. */
export function datasetsOf(paper: PaperCardData): string[] {
  return [...new Set(paper.reported.map((r) => r.dataset))];
}

export const ALL_DATASETS = [...new Set(PAPERS.flatMap(datasetsOf))].sort();

export const YEARS = PAPERS.map((p) => p.year);
export const YEAR_MIN = Math.min(...YEARS);
export const YEAR_MAX = Math.max(...YEARS);
