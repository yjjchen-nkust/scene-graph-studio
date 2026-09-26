import { describe, expect, it } from 'vitest';
import { FRAMES, PREDICATES, SLICE_PREDICATE_COUNT, VG_FRAMES, frameById, vgFrameById } from '../slice';

describe('the placeholder slice, imported at build time', () => {
  it('carries the six committed frames', () => {
    expect(FRAMES).toHaveLength(6);
    expect(FRAMES.map((f) => f.image_id)).toEqual([
      'ph-001', 'ph-002', 'ph-003', 'ph-004', 'ph-005', 'ph-006',
    ]);
  });

  it('every frame has six objects and six relationships', () => {
    for (const frame of FRAMES) {
      expect(frame.objects).toHaveLength(6);
      expect(frame.relationships).toHaveLength(6);
    }
  });

  it('exposes the predicate vocabulary counted from the slice, not asserted', () => {
    // 16 is the number F1 offers as its "this slice" preset. It is counted here so that
    // regenerating the slice moves the number rather than making the label a lie.
    expect(SLICE_PREDICATE_COUNT).toBe(PREDICATES.length);
    expect(SLICE_PREDICATE_COUNT).toBe(16);
    expect(PREDICATES).toEqual([...PREDICATES].sort());
    expect(new Set(PREDICATES).size).toBe(PREDICATES.length);
  });

  it('finds a frame by id and says nothing rather than guessing', () => {
    expect(frameById('ph-003')?.objects).toHaveLength(6);
    expect(frameById('ph-999')).toBeUndefined();
  });
});

describe('the vg150-sgb slice, imported at build time', () => {
  it('carries the 80 committed frames and their 892 annotated edges', () => {
    expect(VG_FRAMES).toHaveLength(80);
    expect(VG_FRAMES.reduce((n, f) => n + f.relationships.length, 0)).toBe(892);
  });

  it('finds a frame by id and says nothing rather than guessing', () => {
    expect(vgFrameById('228')?.relationships.length).toBeGreaterThan(0);
    expect(vgFrameById('no-such-frame')).toBeUndefined();
  });
});
