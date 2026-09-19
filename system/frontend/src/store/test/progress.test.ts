import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadProgress, saveProgress } from '../persist';
import { recordProgress, resumePoint } from '../progress';

beforeEach(() => {
  localStorage.clear();
});

describe('recordProgress', () => {
  it('records how far a reader got', () => {
    recordProgress('m00', 3);
    expect(loadProgress().modules).toEqual({ m00: 3 });
  });

  it('never moves backwards', () => {
    // Reopening a finished module at step zero must not erase the finish. "Where I am" is the
    // URL's job; this is "how far I have been".
    recordProgress('m00', 4);
    recordProgress('m00', 1);
    expect(loadProgress().modules.m00).toBe(4);
  });

  it('leaves other modules alone', () => {
    recordProgress('m00', 2);
    recordProgress('m01', 5);
    expect(loadProgress().modules).toEqual({ m00: 2, m01: 5 });
  });

  it('ignores a call with nothing to record', () => {
    recordProgress('', 3);
    recordProgress('m00', 0);
    expect(loadProgress().modules).toEqual({});
  });

  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => recordProgress('m00', 1)).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe('resumePoint', () => {
  const ORDER = ['m00', 'm01', 'm02', 'm03'];

  it('is null before anything has been read', () => {
    expect(resumePoint(ORDER)).toBeNull();
  });

  it('offers the furthest module in curriculum order, not the last one written', () => {
    saveProgress({ version: 1, modules: { m02: 1, m00: 9 } });
    expect(resumePoint(ORDER)).toEqual({ moduleId: 'm02', stepsSeen: 1 });
  });

  it('ignores a module that is not in the curriculum any more', () => {
    saveProgress({ version: 1, modules: { m99: 4 } });
    expect(resumePoint(ORDER)).toBeNull();
  });
});
