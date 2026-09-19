import raw from '../../../../../data/content/indvissgg_tables.json';

export interface Table3Row {
  components: string;
  O: boolean;
  P: boolean;
  E: boolean;
  source_table: string;
  r_at_20: number;
  mr_at_20: number;
  r_at_50: number;
  mr_at_50: number;
  r_at_100: number;
  mr_at_100: number;
}

export interface Table4Row {
  n_experts: number;
  source_table: string;
  r_at_20: number;
  mr_at_20: number;
  r_at_50: number;
  mr_at_50: number;
  r_at_100: number;
  mr_at_100: number;
}

/**
 * The authors' reported numbers, never this run.
 *
 * All five rows of Table 3 and all four of Table 4, at every cutoff. A four-row cumulative
 * reading of Table 3 hides the superadditive jump, and an @20-only view of Table 4 says N=5
 * dominates N=3, which the other four cutoffs contradict. DEVIATIONS D16.
 */
export const TABLE3 = raw.table3 as Table3Row[];
export const TABLE4 = raw.table4 as Table4Row[];
export const PUBLISHED_NOTE = { en: raw.note_en as string, zh: raw.note_zh as string };
export const TABLE3_READING = {
  en: raw.table3_reading_en as string,
  zh: raw.table3_reading_zh as string,
};
export const TABLE4_READING = {
  en: raw.table4_reading_en as string,
  zh: raw.table4_reading_zh as string,
};
export const SOURCE = raw.source as string;
