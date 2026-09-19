import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const boards = JSON.parse(readFileSync('../data/content/leaderboards.json', 'utf-8'));
const papers = JSON.parse(readFileSync('../data/content/papers.json', 'utf-8'));
const byKey = new Map(papers.map((p) => [p.key, p]));

/** The three axes PRD 6.4 requires a board to name before it shows anyone a number. */
const COLUMNS = ['detector_backbone', 'codebase', 'epoch_budget'];

describe('leaderboards.json', () => {
  it('has a board to check', () => {
    expect(boards.length).toBeGreaterThan(0);
  });

  it('carries the backbone, the codebase and the epoch budget column on every row', () => {
    // Present, not truthy. The plan asserts `toBeTruthy()` on all three, which no row in this
    // corpus can satisfy honestly: IndVisSGG names a backbone for its own rows and nothing for
    // its baselines, and neither it nor Tang et al. nor KERN states a codebase or an epoch
    // budget anywhere. Under D-21 the choice was to invent five columns or to say plainly that
    // the source does not state them, and `null` is that statement. DEVIATIONS D35.
    for (const lb of boards) {
      for (const row of lb.rows) {
        for (const col of COLUMNS) {
          expect(Object.hasOwn(row, col), `${lb.id}/${row.paper_key}: no ${col} column`).toBe(true);
          const v = row[col];
          const ok = v === null || (typeof v === 'string' && v.trim() !== '');
          expect(ok, `${lb.id}/${row.paper_key}: ${col} is neither a value nor null`).toBe(true);
        }
      }
    }
  });

  it('carries a non-comparability banner in both languages that names all three axes', () => {
    for (const lb of boards) {
      expect(lb.banner_en, lb.id).toBeTruthy();
      expect(lb.banner_zh, lb.id).toBeTruthy();
      for (const axis of ['backbone', 'codebase', 'epoch']) {
        expect(lb.banner_en.toLowerCase(), `${lb.id}: banner does not name the ${axis}`)
          .toContain(axis);
      }
    }
  });

  it('records the dated end of the only public leaderboard', () => {
    for (const lb of boards) {
      expect(lb.dead_leaderboard_notice_en, lb.id).toContain('24 July 2025');
      expect(lb.dead_leaderboard_notice_zh, lb.id).toContain('2025');
    }
  });

  it('never mixes protocols or constraint modes inside one board', () => {
    for (const lb of boards) {
      expect(typeof lb.protocol, lb.id).toBe('string');
      expect(typeof lb.constraint, lb.id).toBe('string');
      expect(typeof lb.dataset, lb.id).toBe('string');
    }
  });

  it('never mixes two source tables inside one board', () => {
    // Stronger than the plan's rule and forced by the same corpus that motivates PRD 6.4: this
    // project holds VG-150 PredCls mean recall for FREQ from two tables, 16.0 and 15.8, under
    // identical protocol and constraint. A board keyed on (dataset, protocol, constraint) alone
    // would put them in one column and rank them, which is the thing 6.4 forbids.
    for (const lb of boards) {
      expect(typeof lb.source, lb.id).toBe('string');
      expect(typeof lb.source_table, lb.id).toBe('string');
      expect(byKey.has(lb.source), `${lb.id}: cites '${lb.source}', which has no card`).toBe(true);
    }
  });

  it('quotes every figure from a card, under the board’s own tags', () => {
    // The board is a view of papers.json, never a second copy of the numbers. A figure that is
    // on a board and on no card is a figure that escaped every assertion in papers.test.mjs.
    for (const lb of boards) {
      const paper = (key) => byKey.get(key);
      for (const row of lb.rows) {
        expect(paper(row.paper_key), `${lb.id}: '${row.paper_key}' has no card`).toBeTruthy();
        for (const v of row.values) {
          const hit = paper(row.paper_key).reported.find(
            (r) =>
              r.dataset === lb.dataset &&
              r.metric === v.metric &&
              r.k === v.k &&
              r.value === v.value &&
              r.protocol === lb.protocol &&
              r.constraint === lb.constraint &&
              r.source === lb.source &&
              r.source_table === lb.source_table &&
              (r.backbone ?? null) === row.detector_backbone,
          );
          expect(hit, `${lb.id}/${row.paper_key} ${v.metric}@${v.k}=${v.value}: on no card`)
            .toBeTruthy();
        }
      }
    }
  });

  it('gives every board a unique id', () => {
    const seen = new Set();
    for (const lb of boards) {
      expect(seen.has(lb.id), `duplicate board id: ${lb.id}`).toBe(false);
      seen.add(lb.id);
    }
  });

  it('leaves the rows in the order the source table prints them, never ranked', () => {
    // A board sorted by value is a ranking whatever the banner above it says.
    for (const lb of boards) {
      const values = lb.rows.map((r) => r.values.find((v) => v.metric === 'R' && v.k === 50)?.value);
      const scored = values.filter((v) => typeof v === 'number');
      if (scored.length < 3) continue;
      const descending = scored.every((v, i) => i === 0 || scored[i - 1] >= v);
      const ascending = scored.every((v, i) => i === 0 || scored[i - 1] <= v);
      expect(descending && !ascending, `${lb.id}: rows are in descending R@50 order`).toBe(false);
    }
  });
});
