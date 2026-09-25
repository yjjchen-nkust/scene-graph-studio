import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * The playground rules of `content_lint.mjs`, as a suite rather than as prose.
 *
 * Until 2026-09-20 these rules had no automated test of any kind. Each was watched failing once,
 * by hand, and its message copied into `DEVIATIONS.md` — which satisfies "watched failing before
 * it is kept" and leaves nothing behind that would notice a rule being deleted. Removing any one
 * of them left `npm run ci` green, because the rule's only evidence of existence was a paragraph.
 * A lint is the one kind of code whose absence looks exactly like success.
 *
 * Until 2026-09-26 four of the rules still could not fail here: the fixture had one module and one
 * frontmatter, so a defect needing two modules or two differing locales could not be written, and
 * eight of seventeen mutants passed the suite (D92). Each test below that exists for such a rule
 * says why no other rule can catch its defect; disabling any rule must fail at least one test.
 *
 * The lint resolves every path relative to the working directory, so a fixture corpus is a
 * directory with the same shape and a `cwd`. That is also why this reaches for a subprocess
 * rather than an import: the file does its work at module scope and exits, which is the right
 * design for a gate step and an untestable one in-process.
 *
 * Fixtures are minimal, not faithful: the corpus here carries one module and enough of the
 * surrounding artefacts that the lint reaches the rules under test. Assertions therefore name the
 * message expected rather than demanding an otherwise clean run.
 */

const LINT = resolve(import.meta.dirname, '../content_lint.mjs');
const roots = [];

/** One playground step's frontmatter; the notes key is filled per locale by `corpus`. */
const step = (id, kp) => [
  `  - id: ${id}`, '    kind: playground', `    kp: ${kp}`, '    presenter_notes_LOCALE: "n"',
].join('\n');

/** One `<Step>` block mounting `kp`. */
const block = (id, kp) => `<Step id="${id}">\n\n<Playground kp="${kp}" />\n\n</Step>`;

/**
 * A fixture corpus rooted at a temporary directory, returned as its `system/` path.
 *
 * `frontmatter` and `body` describe m00 in both locales unless `en` overrides either for the
 * English file alone, which is how a cross-locale disagreement is built. `others` adds modules
 * after m00, each written in both locales, for the rules that judge the corpus rather than one
 * module.
 */
function corpus({
  frontmatter, body, en = {}, knowledgePoints = '[F1, F2, Z9]',
  assignment = { m00: ['F1', 'F2', 'Z9'] }, others = [],
  mounts = '  F1: A,\n  F2: B,\n', golden,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sgs-lint-'));
  roots.push(root);
  const write = (p, text) => {
    mkdirSync(join(root, p, '..'), { recursive: true });
    writeFileSync(join(root, p), text, 'utf-8');
  };

  write('data/golden/vectors.json', JSON.stringify({ $schema_version: 1, cases: [] }));
  // Six columns, which is what the parser counts; the two gates are the last two.
  write(
    'data/LICENCES.md',
    '| Dataset | Licence | URL | Checked | annotations_commit | bundle_distribute |\n' +
      '|---|---|---|---|---|---|\n' +
      '| placeholder | generated here | - | 2026-09-20 | YES | YES |\n',
  );
  write('data/content/kp.json', JSON.stringify([{ id: 'F1' }, { id: 'F2' }, { id: 'Z9' }]));
  write('data/content/assignment.json', JSON.stringify({ modules: assignment }));
  write('data/content/papers.json', JSON.stringify([]));
  write('data/content/playground_golden.json', JSON.stringify(golden ?? {
    cases: [{
      id: 'pg-1', kp: 'F1', image_id: 'x', knobs: { a: 1 }, expect: { b: 2 },
      why: 'A sentence long enough to clear the forty character floor this rule imposes.',
    }],
  }));
  write('system/placeholder', '');
  mkdirSync(join(root, 'system/frontend/src/content'), { recursive: true });
  mkdirSync(join(root, 'system/frontend/src/playgrounds'), { recursive: true });
  write('system/frontend/src/playgrounds/mounts.tsx',
    `export const PLAYGROUND_MOUNTS = {\n${mounts}};\n`);

  const m00 = {
    id: 'm00', knowledgePoints, en,
    frontmatter: frontmatter ?? step('s1', 'F1'),
    body: body ?? block('s1', 'F1'),
  };
  for (const [order, m] of [m00, ...others].entries()) {
    for (const [locale, field] of [['zh-TW', 'presenter_notes_zh'], ['en', 'presenter_notes_en']]) {
      const own = locale === 'en' ? { ...m, ...m.en } : m;
      write(`system/frontend/src/content/${m.id}.${locale}.mdx`,
        ['---', `id: ${m.id}`, `order: ${order}`, 'title_en: "T"', 'title_zh: "T"',
          `knowledge_points: ${m.knowledgePoints}`, 'claims: []', 'steps:',
          own.frontmatter.replaceAll('presenter_notes_LOCALE', field), '---', '', own.body, '',
        ].join('\n'));
    }
  }
  return join(root, 'system');
}

function lint(cwd) {
  try {
    execFileSync(process.execPath, [LINT], { cwd, encoding: 'utf-8', stdio: 'pipe' });
    return { ok: true, out: '' };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

describe('content_lint playground rules', () => {
  it('passes a module whose playground step is well formed', () => {
    const r = lint(corpus());
    expect(r.out).not.toMatch(/playground/i);
    expect(r.ok, r.out).toBe(true);
  });

  it('refuses a playground step that names no kp', () => {
    const r = lint(corpus({
      frontmatter: '  - id: s1\n    kind: playground\n    presenter_notes_LOCALE: "n"',
    }));
    expect(r.out).toContain("is a playground and names no kp");
  });

  it('refuses a kp that is not in kp.json', () => {
    const r = lint(corpus({
      frontmatter: '  - id: s1\n    kind: playground\n    kp: QQ\n    presenter_notes_LOCALE: "n"',
      body: '<Step id="s1">\n\n<Playground kp="QQ" />\n\n</Step>',
    }));
    expect(r.out).toContain("names kp 'QQ', not in kp.json");
  });

  it('refuses a kp the module neither owns nor cites', () => {
    // F1 is registered and in kp.json, so this rule is the only one with anything to say.
    const r = lint(corpus({
      knowledgePoints: '[F2, Z9]',
      assignment: { m00: ['F2', 'Z9'], m01: ['F1'] },
    }));
    expect(r.out).toContain("has a playground for 'F1', which this module neither owns nor cites");
  });

  it('accepts a kp the module cites although another module owns it', () => {
    const r = lint(corpus({ assignment: { m00: ['F2', 'Z9'], m01: ['F1'] } }));
    expect(r.out).not.toContain('neither owns nor cites');
    // Clean, so the absence above is the rule's verdict and not a run that stopped early.
    expect(r.ok, r.out).toBe(true);
  });

  it('refuses a playground kp with no registered component', () => {
    const r = lint(corpus({ mounts: '  F2: B,\n' }));
    expect(r.out).toContain("no component is registered for 'F1'");
  });

  it('refuses a step that is a different playground in each locale', () => {
    // The English file is consistent with itself, so no per-file rule can see the defect.
    const r = lint(corpus({ en: { frontmatter: step('s1', 'F2'), body: block('s1', 'F2') } }));
    expect(r.out).toContain("step 's1' is playground/F1 in zh-TW and playground/F2 in en");
  });

  it('refuses a step whose body carries a different kp than its frontmatter', () => {
    const r = lint(corpus({ body: '<Step id="s1">\n\n<Playground kp="F2" />\n\n</Step>' }));
    expect(r.out).toContain("declares kp 'F1' but its body carries F2");
  });

  it('refuses a <Playground> no step declares', () => {
    // Including one placed outside every `<Step>`, which `registry.tsx` renders on every slide.
    const r = lint(corpus({
      body: '<Step id="s1">\n\n<Playground kp="F1" />\n\n</Step>\n\n<Playground kp="F2" />',
    }));
    expect(r.out).toContain('the body mounts <Playground kp="F2" />');
  });

  it('refuses a tag that sits outside the step that declares it', () => {
    const r = lint(corpus({ body: '<Step id="s1">\n\n</Step>\n\n<Playground kp="F1" />' }));
    expect(r.out).toContain("declares kp 'F1' but its body carries no <Playground>");
  });

  it('refuses the same kp mounted by two steps of one module', () => {
    const r = lint(corpus({
      frontmatter: `${step('s1', 'F1')}\n${step('s2', 'F1')}`,
      body: `${block('s1', 'F1')}\n\n${block('s2', 'F1')}`,
    }));
    expect(r.out).toContain("'F1' is mounted more than once in this module");
  });

  it('refuses the same kp mounted by two modules', () => {
    // Each module mounts F1 once and M01 cites it, so every per-module rule passes; only the
    // corpus-wide judgement can see two playgrounds for one point.
    const r = lint(corpus({
      others: [{
        id: 'm01', knowledgePoints: '[F1]', frontmatter: step('s1', 'F1'), body: block('s1', 'F1'),
      }],
    }));
    expect(r.out).toContain("'F1' is mounted by 2 playground steps: m00:s1, m01:s1");
    expect(r.out).not.toContain('more than once in this module');
  });

  it('refuses a golden case whose why does not write out the arithmetic', () => {
    const r = lint(corpus({
      golden: { cases: [{ id: 'pg-1', kp: 'F1', image_id: 'x', knobs: {}, expect: { a: 1 }, why: 'x' }] },
    }));
    expect(r.out).toContain("'why' must write out the arithmetic");
  });

  it('refuses a duplicate golden case id', () => {
    const c = { id: 'pg-1', kp: 'F1', image_id: 'x', knobs: {}, expect: { a: 1 }, why: 'y'.repeat(50) };
    const r = lint(corpus({ golden: { cases: [c, { ...c }] } }));
    expect(r.out).toContain('duplicate playground golden case id: pg-1');
  });

  it('refuses a golden case with no id', () => {
    const r = lint(corpus({
      golden: { cases: [{ kp: 'F1', image_id: 'x', knobs: {}, expect: { a: 1 }, why: 'y'.repeat(50) }] },
    }));
    expect(r.out).toContain('a playground golden case has no id');
  });

  it('refuses a golden case missing a field', () => {
    const r = lint(corpus({
      golden: { cases: [{ id: 'pg-1', kp: 'F1', knobs: {}, expect: { a: 1 }, why: 'y'.repeat(50) }] },
    }));
    expect(r.out).toContain("pg-1: missing 'image_id'");
  });

  it('refuses a golden case whose expect is empty', () => {
    // `{}` is truthy, so the missing-field rule passes it; this is the case that asserts nothing.
    const r = lint(corpus({
      golden: { cases: [{ id: 'pg-1', kp: 'F1', image_id: 'x', knobs: {}, expect: {}, why: 'y'.repeat(50) }] },
    }));
    expect(r.out).toContain("pg-1: 'expect' is empty, so the case asserts nothing");
  });

  it('refuses a golden case for a kp with no registered component', () => {
    const r = lint(corpus({
      golden: {
        cases: [{ id: 'pg-1', kp: 'Z9', image_id: 'x', knobs: {}, expect: { a: 1 }, why: 'y'.repeat(50) }],
      },
    }));
    expect(r.out).toContain("golden case for 'Z9', which has no registered component");
  });
});
