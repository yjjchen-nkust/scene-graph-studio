import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyProgress,
  loadProgress,
  loadSchedule,
  read,
  saveProgress,
  saveSchedule,
  write,
} from '../persist';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadProgress', () => {
  it('returns the typed default when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadProgress()).toEqual({ version: 1, modules: {} });
  });

  it('discards rather than migrates across a version bump', () => {
    localStorage.setItem('sgs:v1:progress', JSON.stringify({ version: 0, modules: { m00: 3 } }));
    expect(loadProgress().modules).toEqual({});
  });

  it('discards a value of the right version but the wrong shape', () => {
    // A hand-edited entry, or a bug in an earlier build. Trusting `version` alone would let
    // `modules` be a string and every reader downstream would fail somewhere less obvious.
    localStorage.setItem('sgs:v1:progress', JSON.stringify({ version: 1, modules: 'all of them' }));
    expect(loadProgress().modules).toEqual({});
  });

  it('discards a value that is not JSON at all', () => {
    localStorage.setItem('sgs:v1:progress', '{ not json');
    expect(loadProgress()).toEqual({ version: 1, modules: {} });
  });

  it('returns what was stored when it is valid', () => {
    saveProgress({ version: 1, modules: { m00: 4, m01: 2 } });
    expect(loadProgress().modules).toEqual({ m00: 4, m01: 2 });
  });

  it('hands back a fresh default each time, not one shared object', () => {
    // A module-level constant returned by reference would let one caller's edit reach another's
    // read, and the private-window path is exactly where that would go unnoticed.
    const a = emptyProgress();
    a.modules.m00 = 9;
    expect(emptyProgress().modules).toEqual({});
  });
});

describe('saveProgress', () => {
  it('never throws on write in a private window', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveProgress({ version: 1, modules: { m00: 1 } })).not.toThrow();
  });
});

describe('the schedule slot', () => {
  it('has its own key and its own default', () => {
    saveProgress({ version: 1, modules: { m00: 1 } });
    expect(loadSchedule()).toEqual({ version: 1, cards: {} });
    expect(localStorage.getItem('sgs:v1:fsrs')).toBeNull();
  });

  it('round-trips a card without touching progress', () => {
    saveSchedule({ version: 1, cards: { 'm00:1': { due: '2026-09-19T00:00:00.000Z', reps: 1 } } });
    expect(Object.keys(loadSchedule().cards)).toEqual(['m00:1']);
    expect(loadProgress().modules).toEqual({});
  });
});

describe('read and write', () => {
  it('namespace and version every key', () => {
    write('lang', 'en');
    expect(localStorage.getItem('sgs:v1:lang')).toBe('"en"');
  });

  it('let a caller reject a value it does not recognise', () => {
    localStorage.setItem('sgs:v1:lang', JSON.stringify('klingon'));
    const locale = read('lang', (v): v is 'en' | 'zh-TW' => v === 'en' || v === 'zh-TW', 'zh-TW');
    expect(locale).toBe('zh-TW');
  });
});
