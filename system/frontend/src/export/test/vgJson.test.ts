import type { SceneGraph } from 'sgg-metrics';
import { describe, expect, it } from 'vitest';
import { fromVisualGenome, toVisualGenome, type VgDocument } from '../vgJson';

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

/**
 * The `visual_genome` driver's local reader, reduced to the keys it reads.
 *
 * `local.py`'s `map_object` renames `object_id` to `id`, pops `attributes`, renames `w`/`h`, and
 * then calls `Object(**obj)`, whose constructor is `(id, x, y, width, height, names, synsets)`: a
 * missing key and an extra key both raise. `parse_graph_local` reads a relationship's
 * `subject_id`, `object_id`, `predicate`, `relationship_id` and `synsets` by name and ignores the
 * rest, and reads a top-level `attributes` as attribute records. The package is not installed
 * here, so the contract is restated rather than imported, and it throws the driver's errors.
 */
function readLikeTheDriver(document: unknown) {
  const data = JSON.parse(JSON.stringify(document)) as {
    objects: Record<string, unknown>[];
    relationships: Record<string, unknown>[];
    attributes?: unknown;
  };
  const constructorKeys = ['height', 'id', 'names', 'synsets', 'width', 'x', 'y'];
  const objects = new Map<unknown, Record<string, unknown>>();
  for (const raw of data.objects) {
    const obj: Record<string, unknown> = { ...raw, id: raw.object_id };
    delete obj.object_id;
    delete obj.attributes;
    if ('w' in obj) {
      obj.width = obj.w;
      obj.height = obj.h;
      delete obj.w;
      delete obj.h;
    }
    const keys = Object.keys(obj).sort();
    const extra = keys.filter((k) => !constructorKeys.includes(k));
    const missing = constructorKeys.filter((k) => !keys.includes(k));
    if (extra.length) {
      throw new TypeError(`Object() got an unexpected keyword argument '${extra[0]}'`);
    }
    if (missing.length) {
      throw new TypeError(`Object() missing required argument: '${missing[0]}'`);
    }
    objects.set(obj.id, obj);
  }
  const relationships = data.relationships.map((rel) => {
    for (const key of ['subject_id', 'object_id', 'predicate', 'relationship_id', 'synsets']) {
      if (!(key in rel)) throw new Error(`KeyError: '${key}'`);
    }
    return {
      id: rel.relationship_id,
      subject: objects.get(rel.subject_id) ?? null,
      predicate: rel.predicate,
      object: objects.get(rel.object_id) ?? null,
    };
  });
  return { objects: [...objects.values()], relationships, attributes: data.attributes };
}

describe('toVisualGenome', () => {
  it("is read by the visual_genome driver's own reader, key for key", () => {
    // D66 said the driver ignores every `sgs_` field. It does on the image and on a
    // relationship; on an object it does not, because the object is built with `Object(**obj)`.
    const masked: SceneGraph = {
      ...GRAPH,
      dataset: 'psg',
      objects: [
        { ...GRAPH.objects[0]!, mask: { counts: 'abc123', size: [600, 800] } },
        GRAPH.objects[1]!,
      ],
    };
    const read = readLikeTheDriver(toVisualGenome(masked));
    expect(read.objects.map((o) => Object.keys(o).sort())).toEqual([
      ['height', 'id', 'names', 'synsets', 'width', 'x', 'y'],
      ['height', 'id', 'names', 'synsets', 'width', 'x', 'y'],
    ]);
    // An object with no WordNet synsets still carries the key the constructor requires.
    expect(read.objects[1]!.synsets).toEqual([]);
    expect(read.relationships).toEqual([
      { id: 1, subject: read.objects[1], predicate: 'on', object: read.objects[0] },
    ]);
    // A top-level `attributes` is read as attribute records; the export has none to give it.
    expect(read.attributes).toBeUndefined();
  });

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

  it('names the two ends of a relationship by id, which is what the driver reads', () => {
    const [relationship] = toVisualGenome(GRAPH).relationships;
    expect(relationship).toMatchObject({
      subject_id: 2,
      object_id: 1,
      predicate: 'on',
      synsets: [],
    });
    expect(relationship).not.toHaveProperty('subject');
    expect(relationship).not.toHaveProperty('object');
  });

  it('keeps the mask off the object, where the driver would refuse it', () => {
    const vg = toVisualGenome({
      ...GRAPH,
      dataset: 'psg',
      objects: [{ ...GRAPH.objects[0]!, mask: { counts: 'abc123', size: [600, 800] } }],
      relationships: [],
    });
    expect(vg.objects[0]).not.toHaveProperty('sgs_mask');
    expect(vg.sgs_masks).toEqual({ '1': { counts: 'abc123', size: [600, 800] } });
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

  it('still reads a file in the nested form this export wrote before', () => {
    // Exported files are on students' disks: relationships carrying two whole object records,
    // the mask as `sgs_mask` on its object, and no `synsets` on an object that had none.
    const earlier: VgDocument = {
      image_id: '2317469',
      width: 800,
      height: 600,
      objects: [
        {
          object_id: 1,
          names: ['table'],
          x: 60,
          y: 300,
          width: 420,
          height: 110,
          sgs_mask: { counts: 'abc123', size: [600, 800] },
        },
        { object_id: 2, names: ['cup'], x: 200, y: 240, width: 60, height: 70 },
      ],
      relationships: [
        {
          relationship_id: 1,
          predicate: 'on',
          subject: { object_id: 2, names: ['cup'], x: 200, y: 240, width: 60, height: 70 },
          object: { object_id: 1, names: ['table'], x: 60, y: 300, width: 420, height: 110 },
          sgs_score: 0.91,
        },
      ],
      sgs_dataset: 'psg',
      sgs_provenance: { kind: 'model', fidelity: 'measured', model: 'reltr' },
    };
    expect(fromVisualGenome(earlier)).toEqual({
      image_id: '2317469',
      dataset: 'psg',
      width: 800,
      height: 600,
      objects: [
        {
          object_id: 1,
          names: ['table'],
          bbox: { x: 60, y: 300, w: 420, h: 110 },
          mask: { counts: 'abc123', size: [600, 800] },
        },
        { object_id: 2, names: ['cup'], bbox: { x: 200, y: 240, w: 60, h: 70 } },
      ],
      relationships: [
        { relationship_id: 1, subject_id: 2, object_id: 1, predicate: 'on', score: 0.91 },
      ],
      provenance: { kind: 'model', fidelity: 'measured', model: 'reltr' },
    });
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
