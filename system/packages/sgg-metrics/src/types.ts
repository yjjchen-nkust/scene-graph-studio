export type DatasetId =
  | 'vrd' | 'vg150-sgb' | 'psg' | 'indoorvg' | 'haystack' | 'mini-isg' | 'placeholder';
export type Protocol = 'predcls' | 'sgcls' | 'sgdet';
export type Constraint = 'graph' | 'none' | 'semi';

/**
 * What a *published* figure may say when its source names no protocol and no constraint mode.
 *
 * The engine never emits `unstated` — `EvalRequest` keeps the strict unions, because there is no
 * such thing as evaluating under an unnamed protocol. It exists only so that a number read off
 * somebody else's table can decline to answer a question that table never asked. IndVisSGG is
 * the case that forced it: eighty-two of this corpus's figures come from its Table 2, and the
 * paper contains no occurrence of SGDet, PredCls, SGCls or "graph constraint". DEVIATIONS D34.
 */
export type ReportedProtocol = Protocol | 'unstated';
export type ReportedConstraint = Constraint | 'unstated';
export type MaskPairing = 'single_mpo' | 'multi_mpo';
export type Fidelity = 'measured' | 'reconstructed' | 'published';
export type VerdictKind = 'match' | 'spurious' | 'localization' | 'missed';

export interface BBox { x: number; y: number; w: number; h: number }
export interface RLEMask { counts: string; size: [number, number] }

export interface SGObject {
  object_id: number;
  names: string[];
  bbox: BBox;
  mask?: RLEMask;
  attributes?: string[];
  synsets?: string[];
}

export interface SGRelationship {
  relationship_id: number;
  subject_id: number;
  object_id: number;
  predicate: string;
  score?: number | null;
}

export interface Provenance {
  kind: 'ground_truth' | 'model' | 'vlm' | 'user';
  fidelity: Fidelity;
  model?: string;
  vlm?: string;
  generated_at?: string;
  note?: string;
}

export interface SceneGraph {
  image_id: string;
  dataset: DatasetId;
  width: number;
  height: number;
  objects: SGObject[];
  relationships: SGRelationship[];
  provenance: Provenance;
}

export interface MetricValue {
  value: number | null;
  metric: 'R' | 'mR' | 'ngR' | 'zR';
  k: number;
  protocol: ReportedProtocol;
  constraint: ReportedConstraint;
  source: string;
  verified: boolean;
  fidelity: Fidelity;
}

export interface Verdict {
  pred_index: number;
  gt_index: number | null;
  verdict: VerdictKind;
  iou_subject: number | null;
  iou_object: number | null;
  rank: number;
  entered_top_k: Record<string, boolean>;
}

export interface Warning { code: string; message_en: string; message_zh: string }

export interface EvalRequest {
  gt: SceneGraph;
  pred: SceneGraph;
  protocol: Protocol;
  constraint: Constraint;
  k: number[];
  iou_thresh: number;
  mask_pairing: MaskPairing;
  zero_shot_train_triplets?: Array<[string, string, string]> | string[][];
  semi_constraint_max_per_pair?: number;
}

export interface EvalResponse {
  metrics: MetricValue[];
  verdicts: Verdict[];
  matched_count: number;
  gt_count: number;
  pred_count_considered: number;
  per_predicate: Array<{ predicate: string; gt_count: number; matched: Record<string, number> }>;
  warnings: Warning[];
  params_echo: EvalRequest;
}

/** The SRS section 3 invariant, checked in the browser so a lab cannot build an invalid graph. */
export function isSceneGraph(value: unknown): value is SceneGraph {
  const g = value as SceneGraph;
  if (!g || typeof g !== 'object') return false;
  if (!Array.isArray(g.objects) || !Array.isArray(g.relationships)) return false;
  const known = new Set(g.objects.map((o) => o.object_id));
  return g.relationships.every((r) => known.has(r.subject_id) && known.has(r.object_id));
}
