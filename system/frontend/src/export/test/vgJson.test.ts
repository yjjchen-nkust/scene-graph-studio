import type { SceneGraph } from 'sgg-metrics';
import { describe, expect, it } from 'vitest';
import { fromVisualGenome, toVisualGenome } from '../vgJson';

const GRAPH: SceneGraph = {
  image_id: '2317469',
  dataset: 'vg150-sgb',
  width: 800,
  height: 600,
  objects: [
    {
      object_id: 1,
      names: ['table', 'desk'],
      bbox: { x: 60, y: 300, w: 420, h: 110 },
      attributes: ['wooden'],
      synsets: ['table.n.02'],
    },
    { object_id: 2, names: ['cup'], bbox: { x: 200, y: 240, w: 60, h: 70 } },
  ],
  relationships: [
    { relationship_id: 1, subject_id: 2, object_id: 1, predicate: 'on', score: 0.91 },
  ],
  provenance: { kind: 'model', fidelity: 'measured', model: 'reltr' },
};

describe('toVisualGenome', () => {
  it('round-trips through the Visual Genome driver shape without loss', () => {
    const vg = toVisualGenome(GRAPH);
    expect(fromVisualGenome(vg)).toEqual(GRAPH);
  });

  it('round-trips a graph carrying a mask', () => {
    const masked: SceneGraph = {
      ...GRAPH,
      dataset: 'psg',
      objects: [
        { ...GRAPH.objects[0]!, mask: { counts: 'abc123', size: [600, 800] } },
        GRAPH.objects[1]!,
      ],
    };
    expect(fromVisualGenome(toVisualGenome(masked))).toEqual(masked);
  });

  it('names the region by the driver field names, not by this one', () => {
    // The point of the export is that the Visual Genome driver reads it. `x`/`y`/`w`/`h` is
    // this project's box; the driver's is `x`/`y`/`width`/`height` on the object itself.
    const [object] = toVisualGenome(GRAPH).objects;
    expect(object).toMatchObject({ object_id: 1, x: 60, y: 300, width: 420, height: 110 });
    expect(object).not.toHaveProperty('bbox');
  });

  it('carries the relationship as subject and object records, as the driver expects', () => {
    const [relationship] = toVisualGenome(GRAPH).relationships;
    expect(relationship!.subject.object_id).toBe(2);
    expect(relationship!.object.object_id).toBe(1);
    expect(relationship!.predicate).toBe('on');
  });

  it('keeps the provenance in a namespaced field the driver ignores', () => {
    // Dropping it would export a number with no source, which NFR-2 forbids; putting it in a
    // driver field would make the export not a Visual Genome file.
    const vg = toVisualGenome(GRAPH);
    expect(vg.sgs_provenance).toEqual(GRAPH.provenance);
  });

  it('keeps a score of null apart from no score at all', () => {
    // `score` is absent on ground truth and `null` where a source states none. Flattening both
    // to absent would make a round trip lose which of the two the file recorded.
    const stated: SceneGraph = {
      ...GRAPH,
      relationships: [{ relationship_id: 1, subject_id: 2, object_id: 1, predicate: 'on', score: null }],
    };
    const absent: SceneGraph = {
      ...GRAPH,
      relationships: [{ relationship_id: 1, subject_id: 2, object_id: 1, predicate: 'on' }],
    };
    expect(fromVisualGenome(toVisualGenome(stated))).toEqual(stated);
    expect(fromVisualGenome(toVisualGenome(absent))).toEqual(absent);
    expect(toVisualGenome(stated)).not.toEqual(toVisualGenome(absent));
  });

  it('refuses a relationship naming an object the graph does not have', () => {
    const dangling: SceneGraph = {
      ...GRAPH,
      relationships: [{ relationship_id: 9, subject_id: 2, object_id: 404, predicate: 'on' }],
    };
    expect(() => toVisualGenome(dangling)).toThrow(/404/);
  });
});

describe('fromVisualGenome', () => {
  it('rejects a document that is not this shape rather than producing a half graph', () => {
    expect(() => fromVisualGenome({ objects: [] } as never)).toThrow();
  });

  it('reads a file that another tool wrote, without the namespaced field', () => {
    const vg = toVisualGenome(GRAPH);
    delete (vg as { sgs_provenance?: unknown }).sgs_provenance;
    const back = fromVisualGenome(vg);
    // An import of unknown origin is `user` at `reconstructed`, and says so, rather than
    // inheriting a fidelity nobody vouched for. D-07.
    expect(back.provenance).toEqual({
      kind: 'user',
      fidelity: 'reconstructed',
      note: 'Imported from a Visual Genome document that carried no provenance.',
    });
  });
});
