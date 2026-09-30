import { describe, expect, it } from 'vitest';
import {
  CLIP_FRAMES,
  CLIP_URL,
  DEFAULT_FRAME,
  FRAME_IDS,
  KEYFRAME_IDS,
  SEGMENT_START,
  TRADITIONAL,
  VLM,
  frameLabel,
  frameUrl,
  keyframeMark,
  resolveFrame,
} from '../data';
import { traditionalTriplets } from '../logic';

const TEN = [
  'm0-demo-088', 'm0-demo-090', 'm0-demo-092', 'm0-demo-094', 'm0-demo-096',
  'm0-demo-098', 'm0-demo-100', 'm0-demo-102', 'm0-demo-104', 'm0-demo-106',
];

/** An object's keys, sorted, for comparing an artefact with the fields its type declares. */
const keys = (value: object) => Object.keys(value).sort();

describe('the demos\' data', () => {
  it('lists the ten frames in the manifest\'s order, and the three keyframes', () => {
    expect(FRAME_IDS).toEqual(TEN);
    expect(KEYFRAME_IDS).toEqual(['m0-demo-090', 'm0-demo-096', 'm0-demo-102']);
    expect(CLIP_FRAMES.map((f) => f.t)).toEqual([88, 90, 92, 94, 96, 98, 100, 102, 104, 106]);
    expect(SEGMENT_START).toBe(88);
  });

  it('bundles a photograph for every frame, and the clip', () => {
    for (const id of FRAME_IDS) expect(frameUrl(id), id).not.toBe('');
    expect(frameUrl('m0-demo-999')).toBe('');
    expect(CLIP_URL).not.toBe('');
  });

  it('carries the same frames in the same order in both artefacts', () => {
    expect(TRADITIONAL.frames.map((f) => f.image_id)).toEqual(FRAME_IDS);
    expect(VLM.frames.map((f) => f.image_id)).toEqual(FRAME_IDS);
  });

  it('names each frame by its time, and the three keyframes t₁, t₂ and t₃ after it', () => {
    expect(FRAME_IDS.map(frameLabel)).toEqual([
      '88 s', '90 s t₁', '92 s', '94 s', '96 s t₂', '98 s', '100 s', '102 s t₃', '104 s', '106 s',
    ]);
    expect(FRAME_IDS.map(keyframeMark).filter(Boolean)).toEqual(['t₁', 't₂', 't₃']);
    expect(frameLabel('m0-demo-999')).toBe('m0-demo-999');
  });

  it('falls back to m0-demo-090 for a frame the clip does not have', () => {
    expect(DEFAULT_FRAME).toBe('m0-demo-090');
    expect(resolveFrame('m0-demo-999')).toBe('m0-demo-090');
    expect(resolveFrame('')).toBe('m0-demo-090');
    expect(resolveFrame(undefined)).toBe('m0-demo-090');
    expect(resolveFrame('m0-demo-096')).toBe('m0-demo-096');
  });

  it('states five calls a frame and |P| = 50', () => {
    expect(VLM.calls_per_frame).toBe(5);
    expect(TRADITIONAL.vg150_predicate_count).toBe(50);
  });

  it('carries exactly the fields the types declare', () => {
    // The JSON is cast to its type, so a renamed field would compile and read as undefined.
    expect(keys(TRADITIONAL)).toEqual([
      '$schema_version', 'class_map', 'detector', 'frames', 'o_isg_coco', 'prior', 'provenance',
      'vg150_predicate_count',
    ]);
    expect(keys(TRADITIONAL.provenance)).toEqual(['fidelity', 'generated_at', 'model', 'note_en', 'note_zh']);
    expect(keys(TRADITIONAL.detector)).toEqual(['threshold', 'weights']);
    expect(keys(TRADITIONAL.prior)).toEqual(['dataset', 'fallback', 'frames', 'predicates', 'rows']);
    const t = TRADITIONAL.frames[0]!;
    expect(keys(t)).toEqual(['detections', 'height', 'image_id', 'keyframe', 'relations', 't', 'width']);
    expect(keys(t.detections[0]!)).toEqual(['bbox', 'label', 'object_id', 'score']);
    expect(keys(t.detections[0]!.bbox)).toEqual(['h', 'w', 'x', 'y']);
    expect(keys(t.relations[0]!)).toEqual(['from', 'object_id', 'predicate', 'subject_id']);

    expect(keys(VLM)).toEqual(['$schema_version', 'E', 'O', 'P', 'calls_per_frame', 'frames', 'prompt_step1', 'provenance']);
    expect(keys(VLM.provenance)).toEqual(['generated_at', 'model', 'note_en', 'note_zh', 'recorded', 'source']);
    expect(keys(VLM.E[0]!)).toEqual(['analysis', 'kind', 'triplet']);
    const v = VLM.frames[0]!;
    expect(keys(v)).toEqual(['draft', 'experts', 'image_id', 'keyframe', 'summary', 't']);
    expect(keys(v.experts[0]!)).toEqual(['analysis_en', 'analysis_zh', 'index', 'revision']);
  });

  it('names two detections of its own frame in every D-T relation', () => {
    for (const frame of TRADITIONAL.frames) {
      expect(traditionalTriplets(frame), frame.image_id).toHaveLength(frame.relations.length);
    }
  });
});
