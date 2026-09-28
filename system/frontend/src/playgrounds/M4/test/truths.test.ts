import { describe, expect, it } from 'vitest';
import en from '../../../i18n/en.json';
import zhTW from '../../../i18n/zh-TW.json';
import { truthsNote } from '../truths';

const tFor = (table: Record<string, string>) => (key: string): string => table[key]!;

describe('truthsNote', () => {
  it('lists matched ids, comma-separated, in English', () => {
    expect(truthsNote([1, 4, 5], 'en', tFor(en))).toBe('of the 6 annotated: g1, g4, g5');
  });

  it('lists matched ids, 、-separated, in 繁體中文', () => {
    expect(truthsNote([1, 4], 'zh-TW', tFor(zhTW))).toBe('共 6 筆標註：g1、g4');
  });

  it('falls back to playground.m4.none when nothing is matched, in each locale', () => {
    expect(truthsNote([], 'en', tFor(en))).toBe('of the 6 annotated: none');
    expect(truthsNote([], 'zh-TW', tFor(zhTW))).toBe('共 6 筆標註：無');
  });
});
