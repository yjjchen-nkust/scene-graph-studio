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

function corpus({ frontmatter, body, mounts = '  F1: A,\n  F2: B,\n', golden } = {}) {
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
  write('data/content/assignment.json', JSON.stringify({ modules: { m00: ['F1', 'F2', 'Z9'] } }));
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

  const fm = frontmatter ?? [
    '  - id: s1',
    '    kind: playground',
    '    kp: F1',
    '    presenter_notes_LOCALE: "note"',
  ].join('\n');
  const bd = body ?? '<Step id="s1">\n\n<Playground kp="F1" />\n\n</Step>';
  for (const [locale, field] of [['zh-TW', 'presenter_notes_zh'], ['en', 'presenter_notes_en']]) {
    write(`system/frontend/src/content/m00.${locale}.mdx`,
      ['---', 'id: m00', 'order: 0', 'title_en: "T"', 'title_zh: "T"',
        'knowledge_points: [F1, F2, Z9]', 'claims: []', 'steps:',
        fm.replaceAll('presenter_notes_LOCALE', field), '---', '', bd, ''].join('\n'));
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
    const r = lint(corpus({
      frontmatter: '  - id: s1\n    kind: playground\n    kp: F1\n    presenter_notes_LOCALE: "n"',
      mounts: '  F2: B,\n',
    }));
    expect(r.out).toContain("no component is registered for 'F1'");
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

  it('refuses the same kp mounted by two steps', () => {
    const fm = [
      '  - id: s1', '    kind: playground', '    kp: F1', '    presenter_notes_LOCALE: "n"',
      '  - id: s2', '    kind: playground', '    kp: F1', '    presenter_notes_LOCALE: "n"',
    ].join('\n');
    const body = '<Step id="s1">\n\n<Playground kp="F1" />\n\n</Step>\n\n' +
      '<Step id="s2">\n\n<Playground kp="F1" />\n\n</Step>';
    const r = lint(corpus({ frontmatter: fm, body }));
    expect(r.out).toMatch(/mounted (more than once|by 2 playground steps)/);
  });

  it('refuses a golden case whose why does not write out the arithmetic', () => {
    const r = lint(corpus({
      golden: { cases: [{ id: 'pg-1', kp: 'F1', image_id: 'x', knobs: {}, expect: { a: 1 }, why: 'x' }] },
    }));
    expect(r.out).toContain("'why' must write out the arithmetic");
  });

  it('refuses a golden case missing its structure, and a duplicate id', () => {
    const r = lint(corpus({
      golden: {
        cases: [
          { id: 'pg-1', kp: 'F1', image_id: 'x', knobs: {}, expect: { a: 1 }, why: 'y'.repeat(50) },
          { id: 'pg-1', kp: 'F1', why: 'y'.repeat(50) },
        ],
      },
    }));
    expect(r.out).toContain('duplicate playground golden case id: pg-1');
    expect(r.out).toContain("missing 'image_id'");
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
