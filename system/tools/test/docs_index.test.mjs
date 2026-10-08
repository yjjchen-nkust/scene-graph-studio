// Fixture suite for docs_index.mjs: one case per rule, the parsers, and the
// five review-focus hazards (CRLF, look-alike tokens, path decorations,
// section id shapes, non-ASCII tracked names).
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  HEADINGS,
  RULES,
  check,
  citations,
  normalise,
  deviationIds,
  loadTree,
  sectionIds,
  trackedFiles,
} from '../docs_index.mjs';

const page = (cites) =>
  ['# S1 X', ...HEADINGS.map((h, i) => (i === 3 ? `${h}\n${cites}` : h))].join('\n\n');

const base = () => ({
  pages: [
    {
      file: 'S01-x.md',
      text: page('D1 D-01 VERIFICATION §1 contracts §1.1 `2026-01-01-a-design.md` `system/a.ts`'),
    },
  ],
  map: '## Path ownership\n\n| Prefix | Id |\n|---|---|\n| `system/` | S1 |\n\n## Next',
  deviations: '## D1 — a',
  verification: '## 1. A',
  decisions: '## D-01 A',
  sectioned: { contracts: '### 1.1 X', SRS: '', design: '', PRD: '' },
  records: ['2026-01-01-a-design.md'],
  tracked: ['system/a.ts', 'docs/x.md', 'README.md'],
  exists: (p) => ['system/a.ts', 'system'].includes(p),
});

const run = (rule, tree) => RULES[rule](tree);

const withCites = (cites) => {
  const t = base();
  t.pages = [{ file: 'S01-x.md', text: page(cites) }];
  return t;
};

describe('docs_index', () => {
  it('the base tree passes every rule', () => {
    expect(check(base())).toEqual([]);
  });

  it('R1 names an uncited deviation', () => {
    const t = base();
    t.deviations += '\n## D2 — b';
    expect(run('R1', t)).toEqual(['D2: cited by no subsystem page']);
  });

  it('R2 names an uncited verification section', () => {
    const t = base();
    t.verification += '\n## 2. B';
    expect(run('R2', t)).toEqual(['VERIFICATION §2: cited by no subsystem page']);
  });

  it('R3 names an uncited spec or plan', () => {
    const t = base();
    t.records = [...t.records, '2026-01-02-b.md'];
    expect(run('R3', t)).toEqual(['2026-01-02-b.md: cited by no subsystem page']);
  });

  it('R4 accepts the map and names an uncited decision', () => {
    const t = base();
    t.decisions += '\n## D-02 B';
    expect(run('R4', t)).toEqual(['D-02: cited by no subsystem page and not by the map']);
    t.map += ' D-02';
    expect(run('R4', t)).toEqual([]);
  });

  it('R5 names each dangling citation', () => {
    const t = withCites('D9 D-09 VERIFICATION §9 contracts §9.9 `2026-09-09-z.md`');
    expect(run('R5', t)).toEqual(
      ['D9', 'D-09', 'VERIFICATION §9', 'contracts §9.9', '2026-09-09-z.md'].map(
        (tok) => `S01-x.md: ${tok} resolves to nothing`,
      ),
    );
  });

  it('R6 names a missing path', () => {
    const t = withCites('`system/missing.ts`');
    expect(run('R6', t)).toEqual(['S01-x.md: system/missing.ts does not exist']);
  });

  it('R6 strips decorations and exempts data/ and globs', () => {
    const t = withCites(
      '`system/a.ts:12` `system/a.ts:3-9` `system/` `system/*.ts` `data/` `data/x.json`',
    );
    // A fresh clone has no data/, so the bare token must be exempt, not found.
    t.exists = (p) => p !== 'data' && base().exists(p);
    expect(run('R6', t)).toEqual([]);
  });

  it('R7 names an unowned file, a stale prefix, a root prefix and a duplicate', () => {
    const unowned = base();
    unowned.tracked = [...unowned.tracked, 'fixtures/f.json'];
    expect(run('R7', unowned)).toEqual(['fixtures/f.json: owned by no prefix']);

    const stale = base();
    stale.map = stale.map.replace('| `system/` | S1 |', '| `system/` | S1 |\n| `web/` | S1 |');
    expect(run('R7', stale)).toEqual(['web/: matches no tracked file']);

    const root = base();
    root.map = root.map.replace('| `system/` | S1 |', '| `system/` | S1 |\n| `/` | S1 |');
    expect(run('R7', root)).toEqual(['/: an empty or root prefix owns everything']);

    const dup = base();
    dup.map = dup.map.replace('| `system/` | S1 |', '| `system/` | S1 |\n| `system/` | S1 |');
    expect(run('R7', dup)).toEqual(['system/: listed twice']);
  });

  it('R7 exempts docs/, CLAUDE.md, README.md and DEVIATIONS.md', () => {
    const t = base();
    t.tracked = [...t.tracked, 'CLAUDE.md', 'DEVIATIONS.md'];
    expect(run('R7', t)).toEqual([]);
  });

  it('R8 names a missing heading, a heading out of order and a wrong title', () => {
    const missing = base();
    missing.pages[0].text = missing.pages[0].text.replace('## 6. Traps', '');
    expect(run('R8', missing)).toEqual(['S01-x.md: missing "## 6. Traps"']);

    const swapped = base();
    swapped.pages[0].text = swapped.pages[0].text
      .replace('## 4. Current rules', '@@4')
      .replace('## 5. Verification', '## 4. Current rules')
      .replace('@@4', '## 5. Verification');
    expect(run('R8', swapped)).toEqual(['S01-x.md: "## 5. Verification" out of order']);

    const title = base();
    title.pages[0].text = title.pages[0].text.replace('# S1 X', '# S2 X');
    expect(run('R8', title)).toEqual(['S01-x.md: title is not "# S1 …"']);
  });

  it('reads CRLF documents as LF', () => {
    const crlf = (v) => {
      if (typeof v === 'string') return v.replaceAll('\n', '\r\n');
      if (Array.isArray(v)) return v.map(crlf);
      if (v && typeof v === 'object') {
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, crlf(x)]));
      }
      return v;
    };
    const t = base();
    const converted = { ...crlf({ ...t, exists: undefined }), exists: t.exists };
    expect(check(converted)).toEqual([]);
    expect(deviationIds('## D1 — a\r\n## D2 — b\r\n')).toEqual([1, 2]);
    expect(normalise('a\r\nb\r\n')).toBe('a\nb\n');
    expect(normalise('a\r\nb')).not.toContain('\r');
  });

  it('ignores tokens that only resemble a deviation', () => {
    expect(citations('kp:D1 D-T D-V 3D D12x').deviations.size).toBe(0);
  });

  it('reads section ids of every shape', () => {
    expect(sectionIds('## 4. SRS — x\n### 4.3 The eval\n### 1.4a `GET`')).toEqual(
      new Set(['4', '4.3', '1.4a']),
    );
    expect(citations('contracts §1.4a and design §4.3.').sections).toEqual([
      { doc: 'contracts', id: '1.4a' },
      { doc: 'design', id: '4.3' },
    ]);
  });

  it('lists tracked files exactly as they exist on disk', () => {
    const root = resolve(import.meta.dirname, '../../..');
    const files = trackedFiles(root);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(existsSync(join(root, f)), f).toBe(true);
      expect(f.startsWith('"')).toBe(false);
    }
  });
});

describe('the real documents', () => {
  const tree = loadTree(resolve(import.meta.dirname, '../../..'));
  it.each(Object.keys(RULES))('%s holds over the repository', (rule) => {
    expect(RULES[rule](tree)).toEqual([]);
  });
});
