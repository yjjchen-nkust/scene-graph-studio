import type { BBox, SceneGraph } from 'sgg-metrics';

/**
 * The correction counter: the whole point of L8.
 *
 * The lab shows a VLM draft beside the frame it was drafted from and counts what the annotator
 * has to do to it. That number is the paper's own motivation reproduced at 0.4% scale — the
 * reason a 10,000-image industrial set is drafted by a model and corrected by hand rather than
 * annotated from nothing — and PRD §6.2 names it as the only place in the application where a
 * student sees what annotation costs.
 *
 * Three decisions make the number honest rather than merely large:
 *
 * 1. **It counts work, not distance.** Deleting a triplet and putting it back is two corrections
 *    and leaves the graph where it started. A counter that reported zero there would be
 *    measuring how far two graphs are apart, which is a different quantity and not the one a
 *    student is being shown.
 * 2. **A click that changes nothing is not work.** Setting a predicate to the value it already
 *    has, or dropping a box back where it was, moves no number. Otherwise the count measures
 *    fidgeting.
 * 3. **A predicate rewrite is one correction.** Recording it as a deletion plus an addition
 *    would inflate the total and would misdescribe what happened: the relation was right and
 *    its name was wrong, which is the third of the three corrections §3.2 of the paper names.
 */

export type Edit =
  | { kind: 'delete'; relationshipId: number }
  | { kind: 'add'; subjectId: number; predicate: string; objectId: number }
  | { kind: 'predicate'; relationshipId: number; predicate: string }
  | { kind: 'box'; objectId: number; bbox: BBox };

export interface EditState {
  graph: SceneGraph;
  /** Only the edits that changed something. `tally` counts this and nothing else. */
  log: Edit[];
  nextRelationshipId: number;
}

export interface Tally {
  deletions: number;
  additions: number;
  predicates: number;
  boxes: number;
  total: number;
}

const CORRECTED_NOTE =
  'Corrected by hand in L8 from a VLM draft. The triplets are the annotator’s, not the model’s.';

function clone(graph: SceneGraph): SceneGraph {
  return {
    ...graph,
    objects: graph.objects.map((o) => ({ ...o, bbox: { ...o.bbox } })),
    relationships: graph.relationships.map((r) => ({ ...r })),
    provenance: { ...graph.provenance },
  };
}

/** The starting state: the draft as it arrived, nothing counted, nothing claimed. */
export function blank(draft: SceneGraph): EditState {
  const highest = draft.relationships.reduce((m, r) => Math.max(m, r.relationship_id), 0);
  return { graph: clone(draft), log: [], nextRelationshipId: highest + 1 };
}

function sameBox(a: BBox, b: BBox): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/**
 * One edit. Returns the state unchanged — and uncounted — when the edit is a no-op.
 *
 * The draft passed to `blank` is never mutated: a lab that edited it in place would lose the
 * "before" the moment the student made their first correction, and the before is half of what
 * the page is showing.
 */
export function applyEdit(state: EditState, edit: Edit): EditState {
  const graph = clone(state.graph);

  switch (edit.kind) {
    case 'delete': {
      const before = graph.relationships.length;
      graph.relationships = graph.relationships.filter(
        (r) => r.relationship_id !== edit.relationshipId,
      );
      if (graph.relationships.length === before) return state;
      break;
    }
    case 'add': {
      const known = new Set(graph.objects.map((o) => o.object_id));
      // An endpoint that is not an object in this frame would produce a relationship the schema
      // cannot validate and the overlay cannot draw. Refused rather than repaired.
      if (!known.has(edit.subjectId) || !known.has(edit.objectId)) return state;
      graph.relationships = [
        ...graph.relationships,
        {
          relationship_id: state.nextRelationshipId,
          subject_id: edit.subjectId,
          predicate: edit.predicate,
          object_id: edit.objectId,
        },
      ];
      return counted(
        { ...state, graph: withUserProvenance(graph), nextRelationshipId: state.nextRelationshipId + 1 },
        edit,
      );
    }
    case 'predicate': {
      const target = graph.relationships.find((r) => r.relationship_id === edit.relationshipId);
      if (!target || target.predicate === edit.predicate) return state;
      target.predicate = edit.predicate;
      break;
    }
    case 'box': {
      const target = graph.objects.find((o) => o.object_id === edit.objectId);
      if (!target || sameBox(target.bbox, edit.bbox)) return state;
      target.bbox = { ...edit.bbox };
      break;
    }
  }

  return counted({ ...state, graph: withUserProvenance(graph) }, edit);
}

function counted(state: EditState, edit: Edit): EditState {
  return { ...state, log: [...state.log, edit] };
}

/**
 * Once a person has changed anything, the graph is theirs.
 *
 * Leaving it under `kind: 'vlm'` would put the annotator's judgement out under a model's name,
 * which is what D-07's provenance rule exists to prevent. An untouched draft keeps the
 * provenance it arrived with, because nothing has been claimed about it.
 */
function withUserProvenance(graph: SceneGraph): SceneGraph {
  return {
    ...graph,
    provenance: {
      ...graph.provenance,
      kind: 'user',
      fidelity: 'measured',
      note: CORRECTED_NOTE,
    },
  };
}

export function tally(state: EditState): Tally {
  const out: Tally = { deletions: 0, additions: 0, predicates: 0, boxes: 0, total: 0 };
  for (const edit of state.log) {
    if (edit.kind === 'delete') out.deletions += 1;
    else if (edit.kind === 'add') out.additions += 1;
    else if (edit.kind === 'predicate') out.predicates += 1;
    else out.boxes += 1;
  }
  out.total = out.deletions + out.additions + out.predicates + out.boxes;
  return out;
}
