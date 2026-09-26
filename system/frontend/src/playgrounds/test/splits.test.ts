import { describe, expect, it } from 'vitest';
import { RELEASES, releaseById } from '../splits';

describe('the release figures X1 reads', () => {
  it('carries the four releases in the order X1 offers them', () => {
    expect(RELEASES.map((r) => r.id)).toEqual(['xu-2017', 'canonical', 'sgb-v1', 'sgb-v2']);
  });

  it('finds a release by id and says nothing rather than guessing', () => {
    expect(releaseById('sgb-v2')?.figures.train?.value).toBe(68538);
    expect(releaseById('vg150')).toBeUndefined();
  });
});
