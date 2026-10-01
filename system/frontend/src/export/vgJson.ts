import type { DatasetId, Provenance, RLEMask, SceneGraph, SGObject } from 'sgg-metrics';

/**
 * The Visual Genome driver's shapes, SRS §3.
 *
 * The reader this targets is the driver's own: `visual_genome`'s `parse_graph_local`, which reads
 * a scene graph document. It names a region `x`/`y`/`width`/`height` on the object itself, not a
 * nested box, and it reads a relationship's two ends as `subject_id` and `object_id`. Exporting
 * this project's own shape under a `.json` extension would produce a file the ecosystem cannot
 * read, which is the one thing the export exists to avoid.
 *
 * **An object carries exactly the driver's keys.** The reader builds each one with
 * `Object(**obj)` after renaming `object_id` to `id` and popping `attributes`, and the
 * constructor is `(id, x, y, width, height, names, synsets)`: a key it does not name raises, and
 * so does a missing `synsets`. That is why the mask is not on the object.
 */
export interface VgObject {
  object_id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  names: string[];
  /** Always present, `[]` where the graph has none: the driver's constructor requires it. */
  synsets: string[];
  /** Popped by the reader before the constructor is called, so it may travel on the object. */
  attributes?: string[];
}

/**
 * A relationship, by id. The reader reads five keys by name and ignores every other, so the
 * score may travel here, namespaced; the object records it resolves come from `objects`.
 */
export interface VgRelationship {
  relationship_id: number;
  subject_id: number;
  object_id: number;
  predicate: string;
  synsets: string[];
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
   * PSG masks, keyed by object id. Top level, because the reader reads only `objects`,
   * `relationships` and `attributes` from the document, and an object cannot carry a key the
   * driver's constructor does not name.
   */
  sgs_masks?: Record<string, RLEMask>;
  /**
   * This project's provenance, namespaced so the driver ignores it and NFR-2 still holds.
   * Dropping it would export a number with no source; putting it in a driver field would make
   * the file not a Visual Genome document.
   */
  sgs_dataset?: DatasetId;
  sgs_provenance?: Provenance;
}

/**
 * What `fromVisualGenome` reads: the form above, and the form this export wrote before it, which
 * files already on students' disks are in. That one nested a whole object record as a
 * relationship's `subject` and `object`, carried the mask on the object as `sgs_mask`, and
 * omitted an object's `synsets` when the graph had none.
 */
export interface VgDocument extends Omit<VgImage, 'objects' | 'relationships'> {
  objects: ReadableVgObject[];
  relationships: Array<
    Omit<VgRelationship, 'subject_id' | 'object_id' | 'synsets'> & {
      subject_id?: number;
      object_id?: number;
      synsets?: string[];
      subject?: ReadableVgObject;
      object?: ReadableVgObject;
    }
  >;
}

type ReadableVgObject = Omit<VgObject, 'synsets'> & { synsets?: string[]; sgs_mask?: RLEMask };

function toVgObject(o: SGObject): VgObject {
  const out: VgObject = {
    object_id: o.object_id,
    x: o.bbox.x,
    y: o.bbox.y,
    width: o.bbox.w,
    height: o.bbox.h,
    names: o.names,
    synsets: o.synsets ?? [],
  };
  if (o.attributes) out.attributes = o.attributes;
  return out;
}

function fromVgObject(o: ReadableVgObject, mask: RLEMask | undefined): SGObject {
  const out: SGObject = {
    object_id: o.object_id,
    names: o.names,
    bbox: { x: o.x, y: o.y, w: o.width, h: o.height },
  };
  if (o.attributes) out.attributes = o.attributes;
  // The export writes `[]` for an object with no synsets, because the driver requires the key,
  // so an empty list reads back as none rather than as a field the graph never had.
  if (o.synsets && o.synsets.length > 0) out.synsets = o.synsets;
  if (mask) out.mask = mask;
  return out;
}

/**
 * A scene graph as a Visual Genome image document.
 *
 * A relationship naming an object the graph does not have makes this throw. The driver would
 * skip it without a word (`parse_graph_local` counts it and moves on), and an export that loses
 * an edge in someone else's tool is worse than one that refuses here.
 */
export function toVisualGenome(graph: SceneGraph): VgImage {
  const known = new Set(graph.objects.map((o) => o.object_id));

  const relationships = graph.relationships.map((r) => {
    if (!known.has(r.subject_id) || !known.has(r.object_id)) {
      const missing = known.has(r.subject_id) ? r.object_id : r.subject_id;
      throw new Error(
        `toVisualGenome: relationship ${r.relationship_id} names object ${missing}, ` +
          `which is not in this graph`,
      );
    }
    const out: VgRelationship = {
      relationship_id: r.relationship_id,
      subject_id: r.subject_id,
      object_id: r.object_id,
      predicate: r.predicate,
      synsets: [],
    };
    // `score` is `number | null` on the wire — absent on ground truth, null where a source
    // states none — and the export keeps the distinction rather than flattening both to absent.
    if (r.score === null) out.sgs_score_null = true;
    else if (r.score !== undefined) out.sgs_score = r.score;
    return out;
  });

  const masked = graph.objects.filter((o) => o.mask);
  const image: VgImage = {
    image_id: graph.image_id,
    width: graph.width,
    height: graph.height,
    objects: graph.objects.map(toVgObject),
    relationships,
    sgs_dataset: graph.dataset,
    sgs_provenance: graph.provenance,
  };
  if (masked.length > 0) {
    image.sgs_masks = Object.fromEntries(masked.map((o) => [String(o.object_id), o.mask!]));
  }
  return image;
}

/** What an imported document is worth when it says nothing about where it came from. D-07. */
const IMPORTED: Provenance = {
  kind: 'user',
  fidelity: 'reconstructed',
  note: 'Imported from a Visual Genome document that carried no provenance.',
};

/** A relationship end by id, or from the nested record the earlier form wrote. */
function endpoint(id: number | undefined, nested: { object_id: number } | undefined): number {
  const resolved = id ?? nested?.object_id;
  if (typeof resolved !== 'number') {
    throw new Error('fromVisualGenome: a relationship names neither an id nor an object record');
  }
  return resolved;
}

export function fromVisualGenome(vg: VgDocument): SceneGraph {
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
    objects: vg.objects.map((o) =>
      fromVgObject(o, vg.sgs_masks?.[String(o.object_id)] ?? o.sgs_mask),
    ),
    relationships: vg.relationships.map((r) => ({
      relationship_id: r.relationship_id,
      subject_id: endpoint(r.subject_id, r.subject),
      object_id: endpoint(r.object_id, r.object),
      predicate: r.predicate,
      ...(r.sgs_score_null ? { score: null } : r.sgs_score !== undefined ? { score: r.sgs_score } : {}),
    })),
    provenance: vg.sgs_provenance ?? IMPORTED,
  };
}
