import type { DatasetId, Provenance, SceneGraph, SGObject } from 'sgg-metrics';

/**
 * The Visual Genome driver's shapes, SRS §3.
 *
 * The driver names a region `x`/`y`/`width`/`height` on the object itself, not a nested box, and
 * carries a relationship as two whole object records rather than two ids. Exporting this
 * project's own shape under a `.json` extension would produce a file the ecosystem cannot read,
 * which is the one thing the export exists to avoid.
 */
export interface VgObject {
  object_id: number;
  names: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  attributes?: string[];
  synsets?: string[];
  /** Namespaced: the driver has no mask field, and PSG graphs carry one. */
  sgs_mask?: { counts: string; size: [number, number] };
}

export interface VgRelationship {
  relationship_id: number;
  predicate: string;
  subject: VgObject;
  object: VgObject;
  synsets?: string[];
  sgs_score?: number;
  /** True where the source relationship carried an explicit `null` rather than no score. */
  sgs_score_null?: boolean;
}

export interface VgImage {
  image_id: string;
  width: number;
  height: number;
  objects: VgObject[];
  relationships: VgRelationship[];
  /**
   * This project's provenance, namespaced so the driver ignores it and NFR-2 still holds.
   * Dropping it would export a number with no source; putting it in a driver field would make
   * the file not a Visual Genome document.
   */
  sgs_dataset?: DatasetId;
  sgs_provenance?: Provenance;
}

function toVgObject(o: SGObject): VgObject {
  const out: VgObject = {
    object_id: o.object_id,
    names: o.names,
    x: o.bbox.x,
    y: o.bbox.y,
    width: o.bbox.w,
    height: o.bbox.h,
  };
  if (o.attributes) out.attributes = o.attributes;
  if (o.synsets) out.synsets = o.synsets;
  if (o.mask) out.sgs_mask = o.mask;
  return out;
}

function fromVgObject(o: VgObject): SGObject {
  const out: SGObject = {
    object_id: o.object_id,
    names: o.names,
    bbox: { x: o.x, y: o.y, w: o.width, h: o.height },
  };
  if (o.attributes) out.attributes = o.attributes;
  if (o.synsets) out.synsets = o.synsets;
  if (o.sgs_mask) out.mask = o.sgs_mask;
  return out;
}

/**
 * A scene graph as a Visual Genome image document.
 *
 * A relationship naming an object the graph does not have makes this throw. The driver would
 * accept the file and then fail on a null subject somewhere else, and an export that produces a
 * file which breaks in someone else's tool is worse than one that refuses here.
 */
export function toVisualGenome(graph: SceneGraph): VgImage {
  const byId = new Map(graph.objects.map((o) => [o.object_id, toVgObject(o)]));

  const relationships = graph.relationships.map((r) => {
    const subject = byId.get(r.subject_id);
    const object = byId.get(r.object_id);
    if (!subject || !object) {
      const missing = subject ? r.object_id : r.subject_id;
      throw new Error(
        `toVisualGenome: relationship ${r.relationship_id} names object ${missing}, ` +
          `which is not in this graph`,
      );
    }
    const out: VgRelationship = { relationship_id: r.relationship_id, predicate: r.predicate, subject, object };
    // `score` is `number | null` on the wire — absent on ground truth, null where a source
    // states none — and the export keeps the distinction rather than flattening both to absent.
    if (r.score === null) out.sgs_score_null = true;
    else if (r.score !== undefined) out.sgs_score = r.score;
    return out;
  });

  return {
    image_id: graph.image_id,
    width: graph.width,
    height: graph.height,
    objects: [...byId.values()],
    relationships,
    sgs_dataset: graph.dataset,
    sgs_provenance: graph.provenance,
  };
}

/** What an imported document is worth when it says nothing about where it came from. D-07. */
const IMPORTED: Provenance = {
  kind: 'user',
  fidelity: 'reconstructed',
  note: 'Imported from a Visual Genome document that carried no provenance.',
};

export function fromVisualGenome(vg: VgImage): SceneGraph {
  if (
    typeof vg?.image_id !== 'string' ||
    typeof vg.width !== 'number' ||
    typeof vg.height !== 'number' ||
    !Array.isArray(vg.objects) ||
    !Array.isArray(vg.relationships)
  ) {
    throw new Error('fromVisualGenome: not a Visual Genome image document');
  }

  return {
    image_id: vg.image_id,
    dataset: vg.sgs_dataset ?? ('placeholder' as DatasetId),
    width: vg.width,
    height: vg.height,
    objects: vg.objects.map(fromVgObject),
    relationships: vg.relationships.map((r) => ({
      relationship_id: r.relationship_id,
      subject_id: r.subject.object_id,
      object_id: r.object.object_id,
      predicate: r.predicate,
      ...(r.sgs_score_null ? { score: null } : r.sgs_score !== undefined ? { score: r.sgs_score } : {}),
    })),
    provenance: vg.sgs_provenance ?? IMPORTED,
  };
}
