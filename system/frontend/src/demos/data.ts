import type { BBox } from 'sgg-metrics';
import CLIP from '../../../../data/demos/m0/clip.mp4?url';
import manifestRaw from '../../../../data/demos/m0/MANIFEST.json';
import vlmRaw from '../../../../data/demos/m0/indvissgg.json';
import traditionalRaw from '../../../../data/demos/m0/traditional.json';

/**
 * The one place a demo's data comes from: the two derived files `build_demo_m0.py` writes, the
 * clip and its ten frames, all under `data/demos/m0/`.
 *
 * Imported at build time, as `playgrounds/slice.ts` imports its slice, so a demo replays what was
 * recorded with no backend, no network and no model running (NFR-1). The types below restate the
 * files field for field (`build_demo_m0.py`, plan Task 5); the JSON is cast to them, so
 * `test/data.test.ts` holds each object's keys to the fields declared here.
 */

/** ⟨subject, predicate, object⟩ as a completion writes it, or as D-T's labels name it. */
export type Triplet = readonly [string, string, string];

export interface Detection {
  object_id: number;
  /** A COCO category name. */
  label: string;
  score: number;
  bbox: BBox;
}

export interface TraditionalRelation {
  subject_id: number;
  object_id: number;
  predicate: string;
  /** `prior`: the class pair's most frequent predicate over the slice; `fallback`: `on`. */
  from: 'prior' | 'fallback';
}

export interface TraditionalFrame {
  image_id: string;
  t: number;
  keyframe: boolean;
  width: number;
  height: number;
  detections: Detection[];
  relations: TraditionalRelation[];
}

export interface TraditionalArtefact {
  $schema_version: number;
  provenance: {
    model: string;
    fidelity: 'measured';
    generated_at: string;
    note_en: string;
    note_zh: string;
  };
  detector: { weights: string; threshold: number };
  prior: { dataset: string; frames: number; rows: number; fallback: string; predicates: string[] };
  /** Every detected COCO label to its slice class, or `null` where the slice has none. */
  class_map: Record<string, string | null>;
  /** Every `O_ISG` class to the COCO category naming it, or `null` where COCO has none. */
  o_isg_coco: Record<string, string | null>;
  vg150_predicate_count: number;
  frames: TraditionalFrame[];
}

export interface ExpertRecord {
  index: number;
  revision: Triplet[];
  /** Model output, shown verbatim; empty where the completion carried no such section. */
  analysis_en: string;
  analysis_zh: string;
}

export interface VlmFrame {
  image_id: string;
  t: number;
  keyframe: boolean;
  /** Step 1's completion, parsed: rows in completion order, duplicates kept. */
  draft: Triplet[];
  experts: ExpertRecord[];
  /** Step 3's completion, parsed, as `draft` is. */
  summary: Triplet[];
}

export interface TecExample {
  kind: 'positive' | 'negative';
  triplet: Triplet;
  analysis: string;
}

export interface VlmArtefact {
  $schema_version: number;
  /** The transcript's provenance block, verbatim. */
  provenance: {
    recorded: boolean;
    model: string;
    generated_at: string;
    source: string;
    note_en: string;
    note_zh: string;
  };
  O: string[];
  P: string[];
  E: TecExample[];
  prompt_step1: string;
  calls_per_frame: number;
  frames: VlmFrame[];
}

/** One frame of the clip, as `MANIFEST.json` states it. */
export interface ClipFrame {
  image_id: string;
  /** Seconds into `01_assy_0_1.mp4`, not into the clip. */
  t: number;
  keyframe: boolean;
}

interface Manifest {
  segment_seconds: [number, number];
  clip: { width: number; height: number };
  frames: { image_id: string; timestamp_seconds: number; keyframe: boolean }[];
}

export const TRADITIONAL = traditionalRaw as unknown as TraditionalArtefact;
export const VLM = vlmRaw as unknown as VlmArtefact;

const manifest = manifestRaw as unknown as Manifest;

export const CLIP_FRAMES: ClipFrame[] = manifest.frames.map((f) => ({
  image_id: f.image_id,
  t: f.timestamp_seconds,
  keyframe: f.keyframe,
}));

export const FRAME_IDS: string[] = CLIP_FRAMES.map((f) => f.image_id);

export const KEYFRAME_IDS: string[] = CLIP_FRAMES.filter((f) => f.keyframe).map((f) => f.image_id);

/** The keyframes' names in time order, as spec §3.1 and Figure 6 name them. */
const KEYFRAME_MARKS = ['t₁', 't₂', 't₃'];

/** A keyframe's name, t₁, t₂ or t₃; `undefined` for any other frame. */
export function keyframeMark(imageId: string): string | undefined {
  const k = KEYFRAME_IDS.indexOf(imageId);
  return k === -1 ? undefined : KEYFRAME_MARKS[k];
}

/**
 * A frame's name on a slide, as the clip's tick reads: its time in the source video, then its
 * keyframe name if it has one. A part that chooses a frame by a list or a thumbnail names it the
 * same way. An id the clip does not have is returned as it is.
 */
export function frameLabel(imageId: string): string {
  const frame = CLIP_FRAMES.find((f) => f.image_id === imageId);
  if (!frame) return imageId;
  const mark = keyframeMark(imageId);
  return mark === undefined ? `${frame.t} s` : `${frame.t} s ${mark}`;
}

/** The frame a demo opens on, and the one an id the clip does not have falls back to: t₁. */
export const DEFAULT_FRAME = 'm0-demo-090';

/** Where the clip starts in the source video, 88 s, so a frame at t sits at t − 88 s in the clip. */
export const SEGMENT_START: number = manifest.segment_seconds[0];

export const CLIP_URL: string = CLIP;

/** The clip's pixel size, so the player has the clip's proportions before its metadata loads. */
export const CLIP_SIZE: { width: number; height: number } = {
  width: manifest.clip.width,
  height: manifest.clip.height,
};

// Vite resolves these at build time and emits them as assets on this origin, as
// `playgrounds/images.ts` does for the placeholder slice.
const FRAME_URLS = import.meta.glob('../../../../data/demos/m0/frames/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** The bundled URL of a demo frame's photograph, or '' if the clip has no frame by that id. */
export function frameUrl(imageId: string): string {
  const hit = Object.entries(FRAME_URLS).find(([path]) => path.endsWith(`/${imageId}.jpg`));
  return hit?.[1] ?? '';
}

/** A frame id from the URL, if the clip has it; otherwise `DEFAULT_FRAME`, never a blank panel. */
export function resolveFrame(id: string | undefined): string {
  return id !== undefined && FRAME_IDS.includes(id) ? id : DEFAULT_FRAME;
}
