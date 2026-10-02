import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { driftFrom, fixtureFiles, FIXTURE } from '../fixture.mjs';

/**
 * The CI fixture, `fixtures/data`, is a copy of files on the NAS (D125, rule 10.4 of the devdata
 * spec). A copy that falls behind passes CI on data nobody reads any more, so outside CI each of
 * its files must equal the NAS's, byte for byte; `npm run fixture:refresh` copies them over.
 * On the runner data/ is the fixture itself, so there is nothing to compare.
 */

const DATA = resolve(import.meta.dirname, '../../../data');
const onTheFixture = (() => {
  try {
    return realpathSync(DATA) === realpathSync(FIXTURE);
  } catch {
    return true;
  }
})();

describe('the CI fixture', () => {
  it('holds files, and none of the corpora, the large slices\' images or the earlier recordings', () => {
    const files = fixtureFiles();
    expect(files.length).toBeGreaterThan(50);
    for (const file of files) {
      expect(file, file).not.toMatch(/^_raw\/|^slices\/(vg150-sgb|psg|indoorvg)\/images\/|pre-D1\d\d|\.pdf$/);
    }
  });

  it.skipIf(onTheFixture)('is the NAS\'s files, byte for byte', () => {
    expect(driftFrom(DATA)).toEqual([]);
  });
});
