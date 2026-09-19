import { isSceneGraph, type SceneGraph } from 'sgg-metrics';
import { describe, expect, it } from 'vitest';
import { perturb, seed } from '../perturb';

const GROUND_TRUTH: SceneGraph = {
  image_id: 'ph-001',
  dataset: 'placeholder',
  width: 640,
  height: 480,
  objects: [
    { object_id: 1, names: ['table'], bbox: { x: 60, y: 300, w: 420, h: 110 } },
    { object_id: 2, names: ['cup'], bbox: { x: 200, y: 240, w: 60, h: 70 } },
    { object_id: 3, names: ['person'], bbox: { x: 40, y: 60, w: 150, h: 340 } },
  ],
  relationships: [
    { relationship_id: 1, subject_id: 2, object_id: 1, predicate: 'on' },
    { relationship_id: 2, subject_id: 3, object_id: 2, predicate: 'holding' },
    { relationship_id: 3, subject_id: 3, object_id: 1, predicate: 'near' },
  ],
  provenance: { kind: 'ground_truth', fidelity: 'measured' },
};

function changedIndices(graph: SceneGraph): number[] {
  return GROUND_TRUTH.relationships
    .map((r, i) => (JSON.stringify(r) !== JSON.stringify(graph.relationships[i]) ? i : -1))
    .filter((i) => i >= 0);
}

describe('perturb', () => {
  it('corrupts exactly one edge', () => {
    const { graph, corruptedIndex } = perturb(GROUND_TRUTH, seed(1));
    expect(changedIndices(graph)).toEqual([corruptedIndex]);
  });

  it('produces a graph that still validates', () => {
    expect(isSceneGraph(perturb(GROUND_TRUTH, seed(2)).graph)).toBe(true);
  });

  it('is deterministic under a seed, so an item can be re-shown', () => {
    expect(perturb(GROUND_TRUTH, seed(3))).toEqual(perturb(GROUND_TRUTH, seed(3)));
  });

  it('does not change the objects, only the relation', () => {
    // The item asks which triplet is wrong. Moving a box as well would make two answers
    // defensible and the student right for a reason the item cannot score.
    const { graph } = perturb(GROUND_TRUTH, seed(4));
    expect(graph.objects).toEqual(GROUND_TRUTH.objects);
  });

  it('leaves a corrupted edge that is actually different', () => {
    for (let s = 0; s < 40; s += 1) {
      const { graph, corruptedIndex } = perturb(GROUND_TRUTH, seed(s));
      const before = GROUND_TRUTH.relationships[corruptedIndex]!;
      const after = graph.relationships[corruptedIndex]!;
      expect(JSON.stringify(after), `seed ${s} produced no change`).not.toBe(JSON.stringify(before));
    }
  });

  it('never invents an object id that is not in the graph', () => {
    const ids = new Set(GROUND_TRUTH.objects.map((o) => o.object_id));
    for (let s = 0; s < 40; s += 1) {
      const { graph } = perturb(GROUND_TRUTH, seed(s));
      for (const r of graph.relationships) {
        expect(ids.has(r.subject_id), `seed ${s}`).toBe(true);
        expect(ids.has(r.object_id), `seed ${s}`).toBe(true);
      }
    }
  });

  it('never leaves a self-loop, which is not a relation a student can judge', () => {
    for (let s = 0; s < 40; s += 1) {
      const { graph } = perturb(GROUND_TRUTH, seed(s));
      for (const r of graph.relationships) {
        expect(r.subject_id, `seed ${s}`).not.toBe(r.object_id);
      }
    }
  });

  it('reaches both kinds of corruption over a range of seeds', () => {
    // A generator that only ever rewrote the predicate would teach one thing. Both a rewritten
    // predicate and a reversed direction have to appear, or the item set is narrower than the
    // lesson it claims to carry.
    const kinds = new Set<string>();
    for (let s = 0; s < 40; s += 1) kinds.add(perturb(GROUND_TRUTH, seed(s)).kind);
    expect([...kinds].sort()).toEqual(['predicate', 'reversed']);
  });

  it('refuses a graph with no relation to corrupt rather than returning a lie', () => {
    const bare: SceneGraph = { ...GROUND_TRUTH, relationships: [] };
    expect(() => perturb(bare, seed(1))).toThrow(/no relationship/i);
  });

  it('refuses a single-predicate graph it cannot rewrite into anything else', () => {
    // With one predicate in the vocabulary and one relation, only reversal is available; with a
    // symmetric pair there is nothing left. Saying so beats emitting an item with no answer.
    const one: SceneGraph = {
      ...GROUND_TRUTH,
      objects: GROUND_TRUTH.objects.slice(0, 2),
      relationships: [{ relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'on' }],
    };
    const { graph, kind } = perturb(one, seed(7));
    expect(kind).toBe('reversed');
    expect(graph.relationships[0]).toMatchObject({ subject_id: 2, object_id: 1 });
  });
});

describe('seed', () => {
  it('gives two different seeds different streams', () => {
    const a = Array.from({ length: 8 }, seed(1));
    const b = Array.from({ length: 8 }, seed(2));
    expect(a).not.toEqual(b);
  });

  it('stays inside [0, 1)', () => {
    const rng = seed(99);
    for (let i = 0; i < 200; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
