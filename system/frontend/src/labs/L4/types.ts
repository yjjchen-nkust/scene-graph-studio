import type { Fidelity, SceneGraph } from 'sgg-metrics';

/** One row of `GET /api/models`, contracts §1.6. */
export interface ModelRow {
  id: string;
  name: string;
  family: 'two_stage' | 'one_stage' | 'panoptic' | 'vlm';
  year: number;
  venue: string;
  paper_key: string;
  live: boolean;
  live_blocked_reason_en: string | null;
  live_blocked_reason_zh: string | null;
  estimated_seconds_per_image: number | null;
  predictions_available: Array<{ dataset: string; fidelity: string }>;
}

/** One model's prediction for the frame under comparison. */
export interface Column {
  model: string;
  graph: SceneGraph;
  fidelity: Fidelity;
  /** Required by D-07 whenever `fidelity` is not `measured`, and rendered without a click. */
  note: string | null;
}

/** A request about one model that failed, carried with the failure so its reason can be shown. */
export interface Failure {
  model: string;
  error: unknown;
}
