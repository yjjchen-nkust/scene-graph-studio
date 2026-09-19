import type { SceneGraph } from 'sgg-metrics';
import { describe, expect, it } from 'vitest';
import { applyEdit, blank, type Edit, tally } from '../corrections';

/**
 * The counter is the lab. PRD §6.2 names it as the only place a student sees what annotation
 * costs, so the thing under test is not that an edit lands — it is that the number beside it is
 * honest: it counts work done, it does not count a click that changed nothing, and it does not
 * decompose one rewrite into a deletion plus an addition.
 */

const DRAFT: SceneGraph = {
  image_id: 'isg-016',
  dataset: 'mini-isg',
  width: 1280,
  height: 720,
  objects: [
    { object_id: 1, names: ['hand'], bbox: { x: 230, y: 265, w: 350, h: 260 } },
    { object_id: 2, names: ['beam'], bbox: { x: 370, y: 440, w: 300, h: 130 } },
    { object_id: 3, names: ['assembly'], bbox: { x: 370, y: 325, w: 640, h: 395 } },
  ],
  relationships: [
    { relationship_id: 1, subject_id: 1, predicate: 'holding', object_id: 2 },
    { relationship_id: 2, subject_id: 1, predicate: 'tightening', object_id: 3 },
  ],
  provenance: { kind: 'vlm', fidelity: 'reconstructed', note: 'a draft' },
};

function run(edits: Edit[]) {
  let state = blank(DRAFT);
  for (const edit of edits) state = applyEdit(state, edit);
  return state;
}

describe('applyEdit', () => {
  it('deletes a triplet and counts one deletion', () => {
    const state = run([{ kind: 'delete', relationshipId: 1 }]);
    expect(state.graph.relationships.map((r) => r.relationship_id)).toEqual([2]);
    expect(tally(state)).toMatchObject({ deletions: 1, additions: 0, predicates: 0, boxes: 0 });
  });

  it('adds a triplet and counts one addition', () => {
    const state = run([{ kind: 'add', subjectId: 2, predicate: 'attached to', objectId: 3 }]);
    expect(state.graph.relationships).toHaveLength(3);
    expect(state.graph.relationships.at(-1)).toMatchObject({
      subject_id: 2,
      predicate: 'attached to',
      object_id: 3,
    });
    expect(tally(state)).toMatchObject({ additions: 1, deletions: 0 });
  });

  it('gives an added triplet an id no existing triplet holds', () => {
    const state = run([
      { kind: 'add', subjectId: 2, predicate: 'attached to', objectId: 3 },
      { kind: 'add', subjectId: 3, predicate: 'on', objectId: 1 },
    ]);
    const ids = state.graph.relationships.map((r) => r.relationship_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rewrites a predicate in place and counts one rewrite, not a deletion and an addition', () => {
    const state = run([{ kind: 'predicate', relationshipId: 2, predicate: 'assembling' }]);
    expect(state.graph.relationships).toHaveLength(2);
    expect(state.graph.relationships[1].predicate).toBe('assembling');
    expect(tally(state)).toMatchObject({ predicates: 1, deletions: 0, additions: 0 });
  });

  it('moves a box and counts one box adjustment, leaving the triplets alone', () => {
    const state = run([
      { kind: 'box', objectId: 2, bbox: { x: 380, y: 450, w: 290, h: 120 } },
    ]);
    expect(state.graph.objects[1].bbox).toEqual({ x: 380, y: 450, w: 290, h: 120 });
    expect(state.graph.relationships).toEqual(DRAFT.relationships);
    expect(tally(state)).toMatchObject({ boxes: 1, deletions: 0, additions: 0, predicates: 0 });
  });

  it('counts work done rather than the net difference', () => {
    // Deleting a triplet and putting it back leaves the graph where it started and the annotator
    // has still done two pieces of work. A counter that reported zero here would be measuring
    // the distance between two graphs, which is not what the lab is about.
    const state = run([
      { kind: 'delete', relationshipId: 1 },
      { kind: 'add', subjectId: 1, predicate: 'holding', objectId: 2 },
    ]);
    expect(tally(state).total).toBe(2);
  });

  it('does not count a rewrite to the predicate the triplet already had', () => {
    const state = run([{ kind: 'predicate', relationshipId: 1, predicate: 'holding' }]);
    expect(tally(state).total).toBe(0);
  });

  it('does not count a box set to the box it already had', () => {
    const state = run([{ kind: 'box', objectId: 1, bbox: { ...DRAFT.objects[0].bbox } }]);
    expect(tally(state).total).toBe(0);
  });

  it('does not count a deletion of a triplet that is not there', () => {
    const state = run([
      { kind: 'delete', relationshipId: 1 },
      { kind: 'delete', relationshipId: 1 },
    ]);
    expect(tally(state).total).toBe(1);
  });

  it('does not count a rewrite of a triplet that has been deleted', () => {
    const state = run([
      { kind: 'delete', relationshipId: 2 },
      { kind: 'predicate', relationshipId: 2, predicate: 'assembling' },
    ]);
    expect(tally(state).total).toBe(1);
  });

  it('refuses to add a triplet whose endpoints are not objects in the frame', () => {
    const state = run([{ kind: 'add', subjectId: 1, predicate: 'on', objectId: 99 }]);
    expect(state.graph.relationships).toHaveLength(2);
    expect(tally(state).total).toBe(0);
  });

  it('leaves the draft it was given untouched', () => {
    const before = JSON.stringify(DRAFT);
    run([
      { kind: 'delete', relationshipId: 1 },
      { kind: 'box', objectId: 1, bbox: { x: 0, y: 0, w: 10, h: 10 } },
    ]);
    expect(JSON.stringify(DRAFT)).toBe(before);
  });

  it('says the corrected graph is the annotator’s work and not the model’s', () => {
    // The draft carries `kind: 'vlm'`. Shipping a corrected graph still labelled `vlm` would put
    // a person's judgement under a model's name, which is the one thing D-07 exists to prevent.
    const state = run([{ kind: 'predicate', relationshipId: 2, predicate: 'assembling' }]);
    expect(state.graph.provenance.kind).toBe('user');
    expect(state.graph.provenance.note).toBeTruthy();
  });

  it('leaves an untouched draft under the provenance it arrived with', () => {
    expect(blank(DRAFT).graph.provenance.kind).toBe('vlm');
  });
});

describe('tally', () => {
  it('totals the four categories', () => {
    const state = run([
      { kind: 'delete', relationshipId: 1 },
      { kind: 'add', subjectId: 2, predicate: 'attached to', objectId: 3 },
      { kind: 'predicate', relationshipId: 2, predicate: 'assembling' },
      { kind: 'box', objectId: 3, bbox: { x: 1, y: 2, w: 3, h: 4 } },
    ]);
    expect(tally(state)).toEqual({
      deletions: 1,
      additions: 1,
      predicates: 1,
      boxes: 1,
      total: 4,
    });
  });

  it('starts at zero on an untouched draft', () => {
    expect(tally(blank(DRAFT))).toEqual({
      deletions: 0,
      additions: 0,
      predicates: 0,
      boxes: 0,
      total: 0,
    });
  });
});
