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

/** One release with one cited figure: the smallest file rule 12 accepts. */
const UNSTATED = { value: null, source: 'card', url: 'https://example.org/card', locator: 'Stats', quote: 'q' };
const SPLITS = {
  $schema_version: 1,
  releases: [{
    id: 'r1', label_en: 'R', label_zh: 'R',
    figures: {
      train: { value: 68538, source: 'card', url: 'https://example.org/card', locator: 'Stats',
        quote: '| train |  68 538 |' },
      val: UNSTATED, test: UNSTATED, val_from: UNSTATED, zero_relation: UNSTATED,
    },
    notes: [],
  }],
};

/** One `<Step>` block mounting `kp`. */
const block = (id, kp) => `<Step id="${id}">\n\n<Playground kp="${kp}" />\n\n</Step>`;

/** A step, and its block, carrying one part of a split playground. */
const partStep = (id, kp, part) => `${step(id, kp)}\n    part: ${part}`;
const partBlock = (id, kp, part) =>
  `<Step id="${id}">\n\n<Playground kp="${kp}" part="${part}" />\n\n</Step>`;
/** F1 in two parts, as steps s1 and s2. */
const SPLIT = {
  parts: '  F1: 2,\n',
  frontmatter: `${partStep('s1', 'F1', 1)}\n${partStep('s2', 'F1', 2)}`,
  body: `${partBlock('s1', 'F1', 1)}\n\n${partBlock('s2', 'F1', 2)}`,
};

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
  mounts = '  F1: A,\n  F2: B,\n', parts = '', golden, splits = SPLITS,
  demos = { mounts: '', parts: '', artefacts: '' }, demoData = {},
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
  if (splits !== null) write('data/content/vg150_splits.json', JSON.stringify(splits));
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
    `export const PLAYGROUND_MOUNTS = {\n${mounts}};\n\nexport const PLAYGROUND_PARTS = {\n${parts}};\n`);
  // Always written, so a corpus that has no demo still has the file the lint reads. The tables are
  // in the form Task 6 wrote: a type annotation before the `=`, one entry to a line.
  mkdirSync(join(root, 'system/frontend/src/demos'), { recursive: true });
  write('system/frontend/src/demos/mounts.tsx',
    `export const DEMO_MOUNTS: Record<string, ComponentType<DemoProps>> = {\n${demos.mounts}};\n\n` +
      `export const DEMO_PARTS: Record<string, number> = {\n${demos.parts}};\n\n` +
      `export const DEMO_ARTEFACTS: Record<string, string> = {\n${demos.artefacts}};\n`);
  for (const [path, data] of Object.entries(demoData)) {
    write(`data/${path}`, typeof data === 'string' ? data : JSON.stringify(data));
  }

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

/** A demo step; `demo` and `part` may be left out (undefined), and `budget` (null), to break a rule. */
const demoStep = (id, demo, part, budget = 60) => [
  `  - id: ${id}`, '    kind: demo',
  ...(demo === undefined ? [] : [`    demo: ${demo}`]),
  ...(part === undefined ? [] : [`    part: ${part}`]),
  ...(budget === null ? [] : [`    seconds_budget: ${budget}`]),
  '    presenter_notes_LOCALE: "n"',
].join('\n');
const demoBlock = (id, demo, part) =>
  `<Step id="${id}">\n\n<Demo id="${demo}" part="${part}" />\n\n</Step>`;

/** D-T in two parts, as steps s1 and s2, with its artefact on disk carrying a provenance. */
const DT = {
  demos: { mounts: '', parts: '  DT: 2,\n', artefacts: "  DT: 'demos/m0/traditional.json',\n" },
  demoData: { 'demos/m0/traditional.json': { provenance: {} } },
  frontmatter: `${demoStep('s1', 'DT', 1)}\n${demoStep('s2', 'DT', 2)}`,
  body: `${demoBlock('s1', 'DT', 1)}\n\n${demoBlock('s2', 'DT', 2)}`,
};

describe('content_lint demo rules', () => {
  it('passes a module whose demo steps are well formed', () => {
    const r = lint(corpus(DT));
    expect(r.out).not.toMatch(/demo/i);
    expect(r.ok, r.out).toBe(true);
  });

  it('accepts a demo registered in DEMO_MOUNTS alone, and one in DEMO_PARTS alone', () => {
    // Tasks 8 and 9 register the mounts after the parts exist, so either table names a demo.
    const both = lint(corpus({ ...DT, demos: { ...DT.demos, mounts: '  DT: Traditional,\n' } }));
    expect(both.ok, both.out).toBe(true);
    const mountOnly = lint(corpus({
      ...DT, demos: { ...DT.demos, mounts: '  DT: Traditional,\n', parts: '' },
      frontmatter: demoStep('s1', 'DT', 1), body: demoBlock('s1', 'DT', 1),
    }));
    expect(mountOnly.out).not.toContain("names demo 'DT'");
  });

  it('refuses a demo step that names no demo, or no part', () => {
    const noDemo = lint(corpus({
      ...DT, frontmatter: demoStep('s1', undefined, 1), body: demoBlock('s1', 'DT', 1),
    }));
    expect(noDemo.out).toContain("step 's1' is a demo and names no demo");
    const unknown = lint(corpus({
      ...DT, frontmatter: demoStep('s1', 'ZZ', 1), body: demoBlock('s1', 'ZZ', 1),
    }));
    expect(unknown.out).toContain("step 's1' names demo 'ZZ', which is in neither DEMO_MOUNTS nor DEMO_PARTS");
    const noPart = lint(corpus({
      ...DT, frontmatter: demoStep('s1', 'DT', undefined), body: demoBlock('s1', 'DT', 1),
    }));
    expect(noPart.out).toContain("step 's1' is a demo and names no integer part");
    const fractional = lint(corpus({
      ...DT, frontmatter: demoStep('s1', 'DT', 1.5), body: demoBlock('s1', 'DT', 1),
    }));
    expect(fractional.out).toContain("step 's1' is a demo and names no integer part");
  });

  it('refuses a demo step whose body carries no matching <Demo>', () => {
    const none = lint(corpus({ ...DT, body: `${demoBlock('s1', 'DT', 1)}\n\n<Step id="s2">\n\n</Step>` }));
    expect(none.out).toContain("step 's2' declares demo 'DT' part 2 but its body carries no <Demo>");
    const other = lint(corpus({ ...DT, body: `${demoBlock('s1', 'DT', 1)}\n\n${demoBlock('s2', 'DV', 2)}` }));
    expect(other.out).toContain("step 's2' declares demo 'DT' part 2 but its body carries DV part 2");
    const part = lint(corpus({ ...DT, body: `${demoBlock('s1', 'DT', 1)}\n\n${demoBlock('s2', 'DT', 1)}` }));
    expect(part.out).toContain("step 's2' declares demo 'DT' part 2 but its body carries DT part 1");
    const two = lint(corpus({
      ...DT, body: `${demoBlock('s1', 'DT', 1)}\n\n<Step id="s2">\n\n<Demo id="DT" part="2" />\n\n<Demo id="DT" part="2" />\n\n</Step>`,
    }));
    expect(two.out).toContain("step 's2' declares demo 'DT' part 2 but its body carries DT part 2, DT part 2");
  });

  it('refuses a <Demo> no step declares', () => {
    // Including one outside every `<Step>`, which the registry renders on every slide.
    const r = lint(corpus({ ...DT, body: `${DT.body}\n\n<Demo id="DT" part="3" />` }));
    expect(r.out).toContain('the body mounts <Demo id="DT" part="3" />, which no step');
  });

  it('refuses a <Demo> mounted more than once in one module', () => {
    // The copy sits outside every `<Step>`, so each step still carries exactly its own tag and the
    // tag is a declared one: only a count over the whole body sees it rendered on every slide.
    const r = lint(corpus({ ...DT, body: `${DT.body}\n\n<Demo id="DT" part="1" />` }));
    expect(r.out).toContain("demo 'DT' part 1 is mounted more than once in this module");
  });

  it('refuses demo parts apart, out of order, or fewer than DEMO_PARTS gives', () => {
    // Every step is well formed on its own, so only the corpus-wide judgement can see it.
    const apart = lint(corpus({
      ...DT,
      frontmatter: `${demoStep('s1', 'DT', 1)}\n${step('s2', 'F1')}\n${demoStep('s3', 'DT', 2)}`,
      body: `${demoBlock('s1', 'DT', 1)}\n\n${block('s2', 'F1')}\n\n${demoBlock('s3', 'DT', 2)}`,
    }));
    expect(apart.out).toContain("demo 'DT' has 2 parts and is mounted as m00:s1 (1), m00:s3 (2)");
    const backwards = lint(corpus({
      ...DT,
      frontmatter: `${demoStep('s1', 'DT', 2)}\n${demoStep('s2', 'DT', 1)}`,
      body: `${demoBlock('s1', 'DT', 2)}\n\n${demoBlock('s2', 'DT', 1)}`,
    }));
    expect(backwards.out).toContain("demo 'DT' has 2 parts and is mounted as m00:s1 (2), m00:s2 (1)");
    const fewer = lint(corpus({ ...DT, demos: { ...DT.demos, parts: '  DT: 3,\n' } }));
    expect(fewer.out).toContain("demo 'DT' has 3 parts and is mounted as m00:s1 (1), m00:s2 (2)");
    const unsized = lint(corpus({ ...DT, demos: { ...DT.demos, parts: '' } }));
    expect(unsized.out).toContain("demo 'DT' has no entry in DEMO_PARTS");
  });

  it('refuses the parts of one demo spread over two modules', () => {
    const r = lint(corpus({
      ...DT,
      frontmatter: demoStep('s1', 'DT', 1), body: demoBlock('s1', 'DT', 1),
      others: [{
        id: 'm01', knowledgePoints: '[F1]', frontmatter: demoStep('s1', 'DT', 2), body: demoBlock('s1', 'DT', 2),
      }],
    }));
    expect(r.out).toContain("demo 'DT' has 2 parts and is mounted as m00:s1 (1), m01:s1 (2)");
  });

  it('refuses a demo whose artefact is missing or carries no provenance', () => {
    const missing = lint(corpus({ ...DT, demoData: {} }));
    expect(missing.out).toContain("demo 'DT': its artefact data/demos/m0/traditional.json does not exist");
    const bare = lint(corpus({ ...DT, demoData: { 'demos/m0/traditional.json': { rows: [] } } }));
    expect(bare.out).toContain("demo 'DT': its artefact data/demos/m0/traditional.json carries no provenance object");
    const broken = lint(corpus({ ...DT, demoData: { 'demos/m0/traditional.json': '{not json' } }));
    expect(broken.out).toContain("demo 'DT': its artefact data/demos/m0/traditional.json is not JSON");
    const unlisted = lint(corpus({ ...DT, demos: { ...DT.demos, artefacts: '' } }));
    expect(unlisted.out).toContain("demo 'DT': DEMO_ARTEFACTS names no artefact for it");
  });

  it('refuses a demo whose artefact lies outside data/demos/', () => {
    // The file exists and carries a provenance, so only the location check can refuse it. The
    // backslash form leaves demos/ on Windows, where existsSync reads `\` as a separator.
    for (const path of [
      'vlm/transcripts/m0-demo.json', 'demos/../vlm/m0-demo.json', '../elsewhere.json', 'demos/..\\vlm\\m0-demo.json',
    ]) {
      const r = lint(corpus({
        ...DT,
        demos: { ...DT.demos, artefacts: `  DT: '${path}',\n` },
        demoData: { [path]: { provenance: {} } },
      }));
      expect(r.out, path).toContain(`demo 'DT': its artefact '${path}' does not lie under demos/ (relative to data/) (rule 4)`);
    }
  });

  it('refuses a demo step with no seconds_budget', () => {
    const r = lint(corpus({
      ...DT,
      frontmatter: `${demoStep('s1', 'DT', 1, null)}\n${demoStep('s2', 'DT', 2)}`,
    }));
    expect(r.out).toContain("step 's1' is a demo and declares no seconds_budget");
  });

  it('refuses a demo that differs between the two locales', () => {
    // Each locale is consistent with itself, so no per-file rule can see the defect.
    const r = lint(corpus({
      ...DT,
      en: {
        frontmatter: `${demoStep('s1', 'DT', 2)}\n${demoStep('s2', 'DT', 1)}`,
        body: `${demoBlock('s1', 'DT', 2)}\n\n${demoBlock('s2', 'DT', 1)}`,
      },
    }));
    expect(r.out).toContain("step 's1' is demo/DT part 1 in zh-TW and demo/DT part 2 in en");
    const kind = lint(corpus({
      ...DT,
      en: { frontmatter: `${step('s1', 'F1')}\n${demoStep('s2', 'DT', 2)}`, body: `${block('s1', 'F1')}\n\n${demoBlock('s2', 'DT', 2)}` },
    }));
    expect(kind.out).toContain("step 's1' is demo/DT part 1 in zh-TW and playground/F1 in en");
    const which = lint(corpus({
      ...DT, demos: { ...DT.demos, parts: '  DT: 2,\n  DV: 2,\n' },
      en: { frontmatter: `${demoStep('s1', 'DV', 1)}\n${demoStep('s2', 'DV', 2)}`, body: `${demoBlock('s1', 'DV', 1)}\n\n${demoBlock('s2', 'DV', 2)}` },
    }));
    expect(which.out).toContain("step 's1' is demo/DT part 1 in zh-TW and demo/DV part 1 in en");
  });
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

  it('refuses a step id declared twice in one module', () => {
    // The playground step finds its tag and a prose step's body is not read, so no other rule has
    // anything to say; `stepBody` reads the first `<Step id="s1">` for both.
    const r = lint(corpus({
      frontmatter: `${step('s1', 'F1')}\n  - id: s1\n    kind: prose\n    presenter_notes_LOCALE: "n"`,
    }));
    expect(r.out).toContain("step id 's1' is declared more than once");
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

  it('accepts a playground split into parts on consecutive steps of one module', () => {
    const r = lint(corpus(SPLIT));
    expect(r.ok, r.out).toBe(true);
  });

  it('refuses a split playground mounted by a step that names no part', () => {
    const r = lint(corpus({ parts: '  F1: 2,\n' }));
    expect(r.out).toContain("'F1' is split into 2 parts, and step 's1' names none");
  });

  it('refuses a part beyond those registered, and a part of a playground not split', () => {
    const beyond = lint(corpus({
      ...SPLIT,
      frontmatter: `${partStep('s1', 'F1', 1)}\n${partStep('s2', 'F1', 3)}`,
      body: `${partBlock('s1', 'F1', 1)}\n\n${partBlock('s2', 'F1', 3)}`,
    }));
    expect(beyond.out).toContain("step 's2' names part 3 of 'F1', which has 2");
    const whole = lint(corpus({ frontmatter: partStep('s1', 'F1', 1), body: partBlock('s1', 'F1', 1) }));
    expect(whole.out).toContain("step 's1' names part 1 of 'F1', which is not split");
  });

  it('refuses a tag whose part is not its step\'s', () => {
    const r = lint(corpus({ ...SPLIT, body: `${partBlock('s1', 'F1', 1)}\n\n${partBlock('s2', 'F1', 1)}` }));
    expect(r.out).toContain("step 's2' declares kp 'F1' part 2 but its body carries F1 part 1");
  });

  it('refuses parts that are not consecutive steps in order', () => {
    // Each step is well formed on its own and every part is present, so only the corpus-wide
    // judgement can see a step standing between them, or the parts running backwards.
    const apart = lint(corpus({
      ...SPLIT,
      frontmatter: `${partStep('s1', 'F1', 1)}\n${step('s2', 'F2')}\n${partStep('s3', 'F1', 2)}`,
      body: `${partBlock('s1', 'F1', 1)}\n\n${block('s2', 'F2')}\n\n${partBlock('s3', 'F1', 2)}`,
    }));
    expect(apart.out).toContain("'F1' is split into 2 parts and mounted as m00:s1 (1), m00:s3 (2)");
    const backwards = lint(corpus({
      ...SPLIT,
      frontmatter: `${partStep('s1', 'F1', 2)}\n${partStep('s2', 'F1', 1)}`,
      body: `${partBlock('s1', 'F1', 2)}\n\n${partBlock('s2', 'F1', 1)}`,
    }));
    expect(backwards.out).toContain("'F1' is split into 2 parts and mounted as m00:s1 (2), m00:s2 (1)");
  });

  it('refuses the parts of one playground spread over two modules', () => {
    const r = lint(corpus({
      parts: '  F1: 2,\n',
      frontmatter: partStep('s1', 'F1', 1),
      body: partBlock('s1', 'F1', 1),
      others: [{
        id: 'm01', knowledgePoints: '[F1]', frontmatter: partStep('s1', 'F1', 2), body: partBlock('s1', 'F1', 2),
      }],
    }));
    expect(r.out).toContain("'F1' is split into 2 parts and mounted as m00:s1 (1), m01:s1 (2)");
  });

  it('refuses a tag for a split playground that no step declares, whole or by a part it lacks', () => {
    // Each step carries its own part correctly, so only the body-wide rule can see a stray tag;
    // until the parts were keyed into it, it compared the point alone, and F1 is declared.
    const whole = lint(corpus({ ...SPLIT, body: `${SPLIT.body}\n\n<Playground kp="F1" />` }));
    expect(whole.out).toContain('the body mounts <Playground kp="F1" />, which no step');
    const third = lint(corpus({ ...SPLIT, body: `${SPLIT.body}\n\n<Playground kp="F1" part="3" />` }));
    expect(third.out).toContain('the body mounts <Playground kp="F1" part="3" />, which no step');
  });

  it('refuses the same part mounted twice in one module', () => {
    const r = lint(corpus({
      ...SPLIT,
      frontmatter: `${partStep('s1', 'F1', 1)}\n${partStep('s2', 'F1', 1)}`,
      body: `${partBlock('s1', 'F1', 1)}\n\n${partBlock('s2', 'F1', 1)}`,
    }));
    expect(r.out).toContain("'F1' part 1 is mounted more than once in this module");
  });

  it('refuses a step that is a different part in each locale', () => {
    // Each locale is consistent with itself, so no per-file rule can see the defect.
    const r = lint(corpus({
      ...SPLIT,
      en: {
        frontmatter: `${partStep('s1', 'F1', 2)}\n${partStep('s2', 'F1', 1)}`,
        body: `${partBlock('s1', 'F1', 2)}\n\n${partBlock('s2', 'F1', 1)}`,
      },
    }));
    expect(r.out).toContain("step 's1' is playground/F1 part 1 in zh-TW and playground/F1 part 2 in en");
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
      golden: { cases: [{ id: 'pg-1', kp: 'F1', image_id: 'x', expect: { a: 1 }, why: 'y'.repeat(50) }] },
    }));
    expect(r.out).toContain("pg-1: missing 'knobs'");
  });

  it('accepts a golden case with a scope in place of a frame', () => {
    const r = lint(corpus({
      golden: { cases: [{ id: 'pg-1', kp: 'F1', scope: 'model', knobs: {}, expect: { a: 1 }, why: 'y'.repeat(50) }] },
    }));
    expect(r.out).not.toContain('pg-1');
    expect(r.ok, r.out).toBe(true);
  });

  it('refuses a golden case with neither a frame nor a scope, and one with both', () => {
    const base = { kp: 'F1', knobs: {}, expect: { a: 1 }, why: 'y'.repeat(50) };
    const r = lint(corpus({
      golden: { cases: [{ id: 'pg-1', ...base }, { id: 'pg-2', image_id: 'x', scope: 'slice', ...base }] },
    }));
    expect(r.out).toContain('pg-1: carries neither image_id nor a scope');
    expect(r.out).toContain('pg-2: carries both image_id and a scope');
  });

  it('refuses a golden case whose scope is not one of the three', () => {
    const r = lint(corpus({
      golden: { cases: [{ id: 'pg-1', kp: 'F1', scope: 'world', knobs: {}, expect: { a: 1 }, why: 'y'.repeat(50) }] },
    }));
    expect(r.out).toContain("pg-1: scope 'world' is not one of slice, model, sources");
  });

  const fig = {
    value: 68538, source: 'card', url: 'https://example.org/card', locator: 'Stats',
    quote: '| train |  68 538 |',
  };
  const withFigure = (f, extra = {}) => ({
    $schema_version: 1,
    releases: [{
      id: 'r1', label_en: 'R', label_zh: 'R',
      figures: { ...SPLITS.releases[0].figures, train: f }, notes: [], ...extra,
    }],
  });

  it('refuses a release figure without its source, url, locator or quote', () => {
    for (const key of ['source', 'url', 'locator', 'quote']) {
      const r = lint(corpus({ splits: withFigure({ ...fig, [key]: '' }) }));
      expect(r.out, key).toContain(`r1.train: no '${key}'`);
    }
  });

  it('refuses a count whose digits are not in its quote', () => {
    const r = lint(corpus({ splits: withFigure({ ...fig, value: 68583 }) }));
    expect(r.out).toContain('r1.train: value 68583 does not appear in its quote');
  });

  it('accepts a null, but not without a quote', () => {
    expect(lint(corpus({ splits: withFigure({ ...fig, value: null }) })).ok).toBe(true);
    const r = lint(corpus({ splits: withFigure({ ...fig, value: null, quote: '' }) }));
    expect(r.out).toContain("r1.train: no 'quote'");
  });

  it('accepts a share its quote states word for word, and refuses one it does not', () => {
    // Xu's 70% and 30% are shown to students as they are; a share has no whole number to match,
    // so it is matched as written.
    const xu = { ...fig, quote: 'We use 70% of the images for training and the remaining 30% for testing.' };
    expect(lint(corpus({ splits: withFigure({ ...xu, value: '70%' }) })).ok).toBe(true);
    const r = lint(corpus({ splits: withFigure({ ...xu, value: '75%' }) }));
    expect(r.out).toContain("r1.train: '75%' does not appear in its quote");
  });

  it('refuses a measurement that disagrees with the figure it measures', () => {
    const r = lint(corpus({ splits: withFigure({ ...fig, measured: { rows: 5000 } }) }));
    expect(r.out).toContain('r1.train: measured 5000 rows but carries 68538');
  });

  it('refuses a note without a numeric value or its two texts', () => {
    const note = { ...fig, value: '10815', text_en: 'kept' };
    const r = lint(corpus({ splits: withFigure(fig, { notes: [note] }) }));
    expect(r.out).toContain('r1.notes[0]: a note needs a numeric value');
    expect(r.out).toContain("r1.notes[0]: no 'text_zh'");
  });

  it('refuses a note that does not name the split it explains', () => {
    const note = { ...fig, value: 68538, text_en: 'kept', text_zh: 'kept' };
    expect(lint(corpus({ splits: withFigure(fig, { notes: [{ ...note, split: 'train' }] }) })).ok).toBe(true);
    const r = lint(corpus({ splits: withFigure(fig, { notes: [note, { ...note, split: 'trainval' }] }) }));
    expect(r.out).toContain("r1.notes[0]: 'split' must be one of train, val, test");
    expect(r.out).toContain("r1.notes[1]: 'split' must be one of train, val, test");
  });

  it('refuses a release without both labels, and a file with no releases', () => {
    const r = lint(corpus({ splits: withFigure(fig, { label_zh: '' }) }));
    expect(r.out).toContain("r1: no 'label_zh'");
    const empty = lint(corpus({ splits: { $schema_version: 1, releases: [] } }));
    expect(empty.out).toContain('vg150_splits.json: no releases');
  });

  it('refuses a missing release file, and one of a schema version it does not know', () => {
    expect(lint(corpus({ splits: null })).out).toContain('vg150_splits.json: missing');
    const future = lint(corpus({ splits: { ...SPLITS, $schema_version: 2 } }));
    expect(future.out).toContain('vg150_splits.json: unknown schema version');
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

  it('refuses a count that is only a run of digits inside a number of its quote', () => {
    // Joining every digit of the quote let 3857 pass against "68 538 | 57 723": it straddles two
    // numbers. A count must equal one whole number of the quote.
    const r = lint(corpus({ splits: withFigure({ ...fig, value: 3857, quote: '| train |  68 538 | 57 723 |', index: 1 }) }));
    expect(r.out).toContain('r1.train: value 3857 does not appear in its quote');
  });

  it('refuses a count from a quote of several numbers that does not say which one it is', () => {
    const r = lint(corpus({ splits: withFigure({ ...fig, quote: '| **Train** | 73,538 | 68,538 |' }) }));
    expect(r.out).toContain("r1.train: its quote holds 2 numbers; 'index' must say which one the figure is");
  });

  it('refuses a count read from the wrong column of its quote', () => {
    // Issue #94's row is COCO then H5. Carrying the H5 figure as the COCO one names column 1 and
    // holds column 2's number, which the joined-digit check could not see.
    const r = lint(corpus({ splits: withFigure({ ...fig, value: 57723, quote: '| **Train** | 73,538 | 57,723 |', index: 1 }) }));
    expect(r.out).toContain('r1.train: index 1 names 73538, not 57723');
  });

  it('accepts a count whose index names it', () => {
    const r = lint(corpus({ splits: withFigure({ ...fig, value: 57723, quote: '| **Train** | 73,538 | 57,723 |', index: 2 }) }));
    expect(r.ok, r.out).toBe(true);
  });

  it('refuses a coded value outside its set', () => {
    const splits = withFigure(fig);
    splits.releases[0].figures.val_from = { ...UNSTATED, value: 'train' };
    splits.releases[0].figures.zero_relation = { ...UNSTATED, value: 'removed' };
    const r = lint(corpus({ splits }));
    expect(r.out).toContain("r1.val_from: 'train' is not one of trainval, test, or null");
    expect(r.out).toContain("r1.zero_relation: 'removed' is not one of kept, dropped, or null");
  });

  it('refuses a release that leaves a figure out rather than saying it is not stated', () => {
    const splits = withFigure(fig);
    delete splits.releases[0].figures.test;
    const r = lint(corpus({ splits }));
    expect(r.out).toContain("r1: no 'test'. A figure the source does not state is null, with its passage.");
  });
});
