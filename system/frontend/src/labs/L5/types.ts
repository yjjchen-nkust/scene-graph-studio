import type { Fidelity } from 'sgg-metrics';

export type Triplet = [string, string, string];

export interface Example {
  kind: 'positive' | 'negative';
  triplet: Triplet;
  analysis: string;
}

/** One row of the student's own run. Deliberately not a metric: see `OwnRun.note`. */
export interface OwnRun {
  components: string;
  triplets: Triplet[];
  fidelity: Fidelity;
  note: string | null;
}

/** Enough of a SceneGraph to name the triplets. Narrower than the wire type, wide enough that
 *  the lab can show what the run produced rather than an empty list. */
export interface ReplicaGraph {
  objects: Array<{ object_id: number; names: string[] }>;
  relationships: Array<{ subject_id: number; object_id: number; predicate: string }>;
}

export interface ReplicaStep {
  graph: ReplicaGraph;
  prompt_shown: string;
}

/** The triplets of one graph, in rank order. */
export function tripletsOf(graph: ReplicaGraph | undefined): Triplet[] {
  if (!graph) return [];
  const byId = new Map(graph.objects.map((o) => [o.object_id, o.names[0] ?? String(o.object_id)]));
  return graph.relationships.map((r) => [
    byId.get(r.subject_id) ?? String(r.subject_id),
    r.predicate,
    byId.get(r.object_id) ?? String(r.object_id),
  ]);
}

export interface ReplicaExpert extends ReplicaStep {
  expert_index: number;
  analysis_en: string;
  analysis_zh: string;
}

/** The body of contracts §1.9, narrowed to what this lab renders. */
export interface ReplicaResult {
  step1: ReplicaStep | null;
  step2: ReplicaExpert[];
  step3: ReplicaStep | null;
  provider_used: 'transcript' | 'claude';
}

export interface ReplicaRequest {
  O: string[];
  P: string[];
  E: Example[];
  n_experts: 1 | 2 | 3 | 5;
  ablate: Array<'O' | 'P' | 'E'>;
  provider: 'transcript' | 'claude';
}
