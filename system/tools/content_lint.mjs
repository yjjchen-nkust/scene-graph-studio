// Content lint: the golden vectors, the licence gates, and the MDX module corpus.
//
// The module rules exist because the presentation contract of SRS §11.2 is structural rather
// than a convention, and a convention is the first thing a deadline removes. Every rule here was
// watched to fail against real content before it was kept; a rule that cannot fail is not a rule.
//
// Written before the modules rather than retrofitted, so `npm run ci` was complete from the
// first commit.
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const problems = [];

// ---- golden vectors -------------------------------------------------------
const golden = JSON.parse(readFileSync('../data/golden/vectors.json', 'utf-8'));
if (golden.$schema_version !== 1) problems.push('data/golden/vectors.json: unknown schema version');

const ids = new Set();
for (const c of golden.cases) {
  if (!c.id) problems.push('a golden case has no id');
  if (ids.has(c.id)) problems.push(`duplicate golden case id: ${c.id}`);
  ids.add(c.id);
  if (c.hand_checked !== true) {
    problems.push(`${c.id}: hand_checked is not true. Every expectation must be computed on ` +
                  `paper from the definitions, never pasted from engine output.`);
  }
  if (!c.why || c.why.length < 40) {
    problems.push(`${c.id}: 'why' must write out the arithmetic a reader would check`);
  }
  for (const key of ['gt', 'pred', 'params', 'expect']) {
    if (!c[key]) problems.push(`${c.id}: missing '${key}'`);
  }
}

// ---- licence gates --------------------------------------------------------
const LICENCES = '../data/LICENCES.md';
const gates = new Map();
for (const line of readFileSync(LICENCES, 'utf-8').split('\n')) {
  if (!line.startsWith('|')) continue;
  const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  if (cells.length !== 6) continue;
  const name = cells[0];
  if (name === 'Dataset' || name === '' || /^[-: ]+$/.test(name)) continue;
  gates.set(name, { commit: cells[4] === 'YES', bundle: cells[5] === 'YES' });
}
if (gates.size === 0) problems.push(`${LICENCES}: no dataset rows parsed`);

// A committed annotations.json implies the annotations_commit gate is cleared. D-08.
const SLICES = '../data/slices';
if (existsSync(SLICES)) {
  for (const ds of readdirSync(SLICES)) {
    if (!existsSync(`${SLICES}/${ds}/annotations.json`)) continue;
    const g = gates.get(ds);
    if (!g) problems.push(`${ds}: annotations committed but no row in ${LICENCES}`);
    else if (!g.commit) {
      problems.push(`${ds}: annotations committed but ${LICENCES} does not clear ` +
                    `annotations_commit. UNCLEAR counts as NO.`);
    }
  }
}

// ---- the module corpus ----------------------------------------------------
// Frontmatter is read with a small reader rather than a YAML dependency. The schema is fixed by
// contracts §3.1 and is scalars, flow sequences and lists of flat maps; a parser that accepted
// more than the schema allows would accept a module the schema forbids.
const CONTENT = 'frontend/src/content';
const LOCALES = ['zh-TW', 'en'];
const CONTRACT = ['Intuition', 'Formal', 'Worked', 'Implications'];
// The presenter-notes field each locale file owns. D56: the field name carries the locale, so a
// zh-TW file writing `presenter_notes_en` is the same sentence in the wrong place.
const NOTES = { 'zh-TW': 'presenter_notes_zh', en: 'presenter_notes_en' };
const FOREIGN = { 'zh-TW': 'presenter_notes_en', en: 'presenter_notes_zh' };

// Collected by `scalar` and reported against the file being read.
let badEscapes = [];

/** The escapes a YAML double-quoted scalar allows, minus the numeric forms handled below. */
const YAML_ESCAPES = new Set([
  '0', 'a', 'b', 't', 'n', 'v', 'f', 'r', 'e', ' ', '"', '/', '\\', 'N', '_', 'L', 'P', '\t',
]);

/**
 * The first invalid escape in a double-quoted scalar, or null.
 *
 * Written as a scan rather than a regex because the first attempt was a regex with a negative
 * lookahead, and it reported `\\mathcal{P}` — a correctly escaped backslash — as invalid: after
 * rejecting a match at the first backslash it simply advanced one character and matched at the
 * second. An escape has to be consumed whole, which a stateless lookahead cannot do.
 */
function invalidEscape(inner) {
  for (let i = 0; i < inner.length; i += 1) {
    if (inner[i] !== '\\') continue;
    const next = inner[i + 1];
    if (next === undefined) return '\\ at the end of the scalar';
    if (YAML_ESCAPES.has(next)) {
      i += 1;
      continue;
    }
    const width = next === 'x' ? 2 : next === 'u' ? 4 : next === 'U' ? 8 : 0;
    if (width && /^[0-9a-fA-F]+$/.test(inner.slice(i + 2, i + 2 + width))) {
      i += 1 + width;
      continue;
    }
    return `\\${next}`;
  }
  return null;
}

function scalar(raw) {
  const text = raw.trim();
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if (/^\[.*\]$/.test(text)) {
    const inner = text.slice(1, -1).trim();
    return inner === '' ? [] : inner.split(',').map((x) => scalar(x));
  }
  if (/^\{.*\}$/.test(text)) {
    const out = {};
    for (const pair of text.slice(1, -1).split(',')) {
      const at = pair.indexOf(':');
      if (at > 0) out[pair.slice(0, at).trim()] = scalar(pair.slice(at + 1));
    }
    return out;
  }
  if (/^'.*'$/.test(text)) return text.slice(1, -1);
  if (/^".*"$/.test(text)) {
    const inner = text.slice(1, -1);
    // A double-quoted YAML scalar processes escapes, and `remark-mdx-frontmatter` parses this
    // block with a real YAML parser at build time. A lone `\o` is an invalid escape and fails
    // the build. Reading it leniently here was worse than not reading it at all: every symbol in
    // this corpus is LaTeX, so the lint passed a corpus the build could not compile. D31.
    const bad = invalidEscape(inner);
    if (bad) badEscapes.push(`${text} — invalid YAML escape '${bad}'`);
    return inner.replace(/\\(.)/g, '$1');
  }
  return text;
}

/**
 * The slice of an MDX body inside one `<Step id="...">`, bounded by its own closing tag.
 *
 * Bounded at `</Step>` rather than at the next `<Step id="`, which is what it read until
 * 2026-09-20. The difference is everything between one step's close and the next one's open, and
 * that region is not nothing: `registry.tsx` renders the *whole* body for every step with `Step`
 * filtered to admit one id, so anything outside a `Step` block has no filter over it and renders
 * on every slide of the module. Attributing it to the preceding step made rule 5 report content
 * as correctly placed when it was about to appear seven times.
 */
function stepBody(body, stepId) {
  const open = body.indexOf(`<Step id="${stepId}">`);
  if (open < 0) return '';
  const close = body.indexOf('</Step>', open + 1);
  const next = body.indexOf('<Step id="', open + 1);
  const end = [close, next].filter((i) => i >= 0);
  return body.slice(open, end.length ? Math.min(...end) : body.length);
}

function frontmatter(source, where) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!match) {
    problems.push(`${where}: no frontmatter block`);
    return null;
  }
  const out = {};
  let key = null;
  let list = null;
  let item = null;
  for (const raw of match[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    if (indent === 0) {
      if (list && key) out[key] = list;
      list = null;
      item = null;
      const at = line.indexOf(':');
      if (at < 0) continue;
      key = line.slice(0, at).trim();
      const rest = line.slice(at + 1).trim();
      if (rest === '') {
        list = [];
      } else {
        out[key] = scalar(rest);
        key = null;
      }
    } else if (line.startsWith('- ')) {
      const rest = line.slice(2).trim();
      if (rest.startsWith('{')) {
        item = scalar(rest);
      } else {
        const at = rest.indexOf(':');
        item = {};
        if (at > 0) item[rest.slice(0, at).trim()] = scalar(rest.slice(at + 1));
      }
      if (list) list.push(item);
    } else if (item && typeof item === 'object') {
      const at = line.indexOf(':');
      if (at > 0) item[line.slice(0, at).trim()] = scalar(line.slice(at + 1));
    }
  }
  if (list && key) out[key] = list;
  return out;
}

const POINTS = JSON.parse(readFileSync('../data/content/kp.json', 'utf-8'));
const KP = new Set(POINTS.map((p) => p.id));

// Which module teaches each point. A separate file from kp.json on purpose: kp.json is harvest
// output and `npm run harvest` rewrites it wholesale, so an editorial field stored there is
// erased by the next CI run. D29.
const ASSIGNMENT = JSON.parse(readFileSync('../data/content/assignment.json', 'utf-8')).modules;

// The registered playgrounds, read from the mount table rather than from a list beside it. A
// regex over a .tsx file is crude, and the alternative is a second list that can disagree with
// the first -- which is the failure this whole file exists to catch.
//
// Paths in this file are relative to system/, as every other read here is.
const REGISTERED = new Set(
  [...readFileSync('frontend/src/playgrounds/mounts.tsx', 'utf-8')
    .matchAll(/^\s{2}([A-Z]\d+):\s/gm)].map((m) => m[1]),
);

const PLAYGROUND_GOLDEN = JSON.parse(
  readFileSync('../data/content/playground_golden.json', 'utf-8'),
);

// The playground golden cases. Not beside the evaluation engine's golden-vector check at the top
// of this file, although they are the same kind of artefact: this rule needs REGISTERED, and a
// const is not reachable before its declaration.
const playgroundGoldenIds = new Set();
const SCOPES = new Set(['slice', 'model', 'sources']);
for (const c of PLAYGROUND_GOLDEN.cases) {
  // The same structural guard the engine's vectors get at the top of this file. It had only the
  // two rules below, so a case missing its `knobs` or `expect`, or repeating another's id, was
  // this file's business and this file said nothing. `golden.test.ts` throws on it, which makes
  // the gate red somewhere -- but a lint whose subject is the golden file should be the thing
  // that names the defect.
  if (!c.id) problems.push('a playground golden case has no id');
  if (playgroundGoldenIds.has(c.id)) {
    problems.push(`duplicate playground golden case id: ${c.id}`);
  }
  playgroundGoldenIds.add(c.id);
  for (const key of ['kp', 'knobs', 'expect']) {
    if (!c[key]) problems.push(`${c.id}: missing '${key}'`);
  }
  // A case pins a frame's arithmetic, or a slice's, a model's or the sources'. F1, F2, F6 and F8
  // read a frame; F7's model and X1's cited figures have none, and demanding an `image_id` of
  // them would have meant inventing one (spec 2026-09-26 §6).
  if (c.scope !== undefined && !SCOPES.has(c.scope)) {
    problems.push(`${c.id}: scope '${c.scope}' is not one of ${[...SCOPES].join(', ')}`);
  }
  if (Boolean(c.image_id) === (c.scope !== undefined)) {
    problems.push(
      `${c.id}: carries ${c.image_id ? 'both image_id and a scope' : 'neither image_id nor a scope'}`,
    );
  }
  if (c.expect && Object.keys(c.expect).length === 0) {
    problems.push(`${c.id}: 'expect' is empty, so the case asserts nothing`);
  }
  if (!c.why || c.why.length < 40) {
    problems.push(`${c.id}: 'why' must write out the arithmetic a reader would check`);
  }
  if (!REGISTERED.has(c.kp)) {
    problems.push(`${c.id}: golden case for '${c.kp}', which has no registered component`);
  }
}
const owned = new Map(Object.entries(ASSIGNMENT));
const moduleOf = new Map();
for (const [module, points] of owned) {
  for (const point of points) {
    if (moduleOf.has(point)) {
      problems.push(`${point} is assigned to both ${moduleOf.get(point)} and ${module}`);
    }
    moduleOf.set(point, module);
    if (!KP.has(point)) problems.push(`${module} is assigned '${point}', absent from kp.json`);
  }
}

// Every harvested point belongs to exactly one module. An unassigned point is a piece of the
// syllabus nobody has agreed to teach, and it disappears silently: the corpus looks complete
// because every module that exists is well-formed.
const unassigned = POINTS.filter((p) => !moduleOf.has(p.id));
if (unassigned.length) {
  problems.push(`${unassigned.length} knowledge point(s) belong to no module: ` +
                unassigned.map((p) => p.id).join(', '));
}
const PAPERS = existsSync('../data/content/papers.json')
  // `key`, not `id`: contracts §3.2 names the field `key` and every module claim cites one.
  ? new Set(JSON.parse(readFileSync('../data/content/papers.json', 'utf-8')).map((p) => p.key))
  : null;

const modules = new Map();
if (existsSync(CONTENT)) {
  for (const file of readdirSync(CONTENT)) {
    const parsed = /^(m\d\d)\.([\w-]+)\.mdx$/.exec(file);
    if (!parsed) continue;
    const [, id, locale] = parsed;
    const source = readFileSync(`${CONTENT}/${file}`, 'utf-8');
    badEscapes = [];
    const meta = frontmatter(source, file);
    for (const bad of badEscapes) problems.push(`${file}: ${bad}`);
    if (!meta) continue;
    if (!modules.has(id)) modules.set(id, {});
    modules.get(id)[locale] = { meta, source, file };
  }
}

if (modules.size === 0) problems.push(`${CONTENT}: no modules found. Plan 02 Task 7 writes m00.`);

const glosses = new Map();
// Which steps mount each knowledge point, across the whole corpus. Spec 2.4 rule 7 says no kp is
// used by two playground steps and does not qualify that by module; the body rule below is
// per-module because it reads one module's body, and on its own it would pass two modules that
// each cite the same point and each mount it.
const mountedBy = new Map();
for (const [id, locales] of [...modules].sort()) {
  // Both locales, or neither. NFR-6: a half-translated build must not look finished.
  for (const locale of LOCALES) {
    if (!locales[locale]) problems.push(`${id}: missing the ${locale} locale`);
  }
  const present = LOCALES.filter((l) => locales[l]);

  if (present.length === LOCALES.length) {
    const [a, b] = LOCALES.map((l) => locales[l].meta.steps ?? []);
    if (a.length !== b.length) {
      problems.push(`${id}: ${a.length} steps in ${LOCALES[0]}, ${b.length} in ${LOCALES[1]}. ` +
                    `The shells index the two locales by the same position.`);
    } else {
      for (let i = 0; i < a.length; i += 1) {
        if (a[i].id !== b[i].id) {
          problems.push(
            `${id}: step ${i} is '${a[i].id}' in ${LOCALES[0]} and '${b[i].id}' in ${LOCALES[1]}`,
          );
        }
      }

      // Presenter notes, D56. A module is two files and each carries its own locale's field, so
      // the two must agree on *which* steps have notes or the professor gets a notes pane in one
      // language and an empty one in the other -- the half-translated build NFR-6 forbids, in the
      // one window nobody in the room can see going wrong.
      const noted = LOCALES.map((l, k) =>
        (k === 0 ? a : b).filter((s) => s[NOTES[l]] !== undefined).map((s) => s.id),
      );
      if (noted[0].join(',') !== noted[1].join(',')) {
        problems.push(
          `${id}: presenter notes on [${noted[0].join(', ') || 'none'}] in ${LOCALES[0]} but ` +
            `[${noted[1].join(', ') || 'none'}] in ${LOCALES[1]}. Both locales or neither.`,
        );
      }

      // A step's kind and kp are not translated, so the two files must name the same component
      // at the same position. Divergence here puts a different playground on the projector when
      // the lecturer switches language mid-class, which the step-id check above cannot see.
      for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
        if (a[i].kind === 'playground' || b[i].kind === 'playground') {
          if (a[i].kind !== b[i].kind || a[i].kp !== b[i].kp) {
            problems.push(`${id}: step '${a[i].id}' is ${a[i].kind}/${a[i].kp ?? '\u2014'} in ` +
                          `${LOCALES[0]} and ${b[i].kind}/${b[i].kp ?? '\u2014'} in ${LOCALES[1]}. ` +
                          `A playground must be the same playground in both languages.`);
          }
        }
      }
    }
  }

  for (const locale of present) {
    const { meta, source, file } = locales[locale];
    if (meta.id !== id) {
      problems.push(`${file}: frontmatter id '${meta.id}' does not match the filename`);
    }

    // Hoisted above the step loop: the playground rules read the body too, and computing it
    // twice from the same source is two places for the offset arithmetic to drift.
    const body = source.slice(source.indexOf('\n---', 4) + 4);

    for (const step of meta.steps ?? []) {
      if (step[FOREIGN[locale]] !== undefined) {
        problems.push(
          `${file}: step '${step.id}' carries ${FOREIGN[locale]}. A locale file owns ` +
            `${NOTES[locale]} only; the other locale's notes live in the other file.`,
        );
      }
      const note = step[NOTES[locale]];
      if (note !== undefined && (typeof note !== 'string' || note.trim() === '')) {
        problems.push(
          `${file}: step '${step.id}' declares ${NOTES[locale]} with nothing in it. ` +
            `Leave the key out; the presenter window says when a step has no notes.`,
        );
      }
      // Every step carries notes, as of 2026-09-19. Until then M00 was the only module with any,
      // and the presenter window told the lecturer so on 88 steps out of 92 -- correct behaviour
      // reporting an absent artefact. The artefact now exists for all of them, and this rule is
      // what stops the next module being added without its own. D76.
      if (note === undefined) {
        problems.push(
          `${file}: step '${step.id}' has no ${NOTES[locale]}. Every step carries presenter ` +
            `notes; a new module writes its own rather than shipping an empty notes pane.`,
        );
      }

      // The playground contract, contracts §2.4. A playground is the one step kind whose
      // frontmatter names a component in another tree, so every way the two can disagree is a
      // way the lecture shows an empty box on a projector.
      if (step.kind === 'playground') {
        if (!step.kp) {
          problems.push(`${file}: step '${step.id}' is a playground and names no kp. ` +
                        `Contracts §2.4 requires one.`);
        } else {
          if (!KP.has(step.kp)) {
            problems.push(`${file}: step '${step.id}' names kp '${step.kp}', not in kp.json`);
          }
          const ownedHere = (ASSIGNMENT[meta.id] ?? []).includes(step.kp);
          const cited = (meta.knowledge_points ?? []).includes(step.kp);
          if (!ownedHere && !cited) {
            problems.push(`${file}: step '${step.id}' has a playground for '${step.kp}', which ` +
                          `this module neither owns nor cites. A playground for a point the ` +
                          `module does not teach is a misfiled widget.`);
          }
          if (!REGISTERED.has(step.kp)) {
            problems.push(`${file}: no component is registered for '${step.kp}' in ` +
                          `frontend/src/playgrounds/mounts.tsx`);
          }
          // One entry per module and step, not per locale: the two locale files describe the
          // same step and must not be counted as two uses of it.
          mountedBy.set(
            step.kp,
            new Set([...(mountedBy.get(step.kp) ?? []), `${meta.id}:${step.id}`]),
          );
          const tags = [...body.matchAll(/<Playground\s+kp="([^"]+)"/g)].map((m) => m[1]);
          const forThisStep = stepBody(body, step.id);
          const inStep = [...forThisStep.matchAll(/<Playground\s+kp="([^"]+)"/g)].map((m) => m[1]);
          if (inStep.length !== 1 || inStep[0] !== step.kp) {
            problems.push(`${file}: step '${step.id}' declares kp '${step.kp}' but its body ` +
                          `carries ${inStep.length === 0 ? 'no <Playground>' : inStep.join(', ')}. ` +
                          `Frontmatter and body disagreeing is the defect this catches.`);
          }
          if (tags.filter((t) => t === step.kp).length > 1) {
            problems.push(`${file}: '${step.kp}' is mounted more than once in this module`);
          }
        }
      }
    }

    // Every `<Playground>` in the body answers to a declared step. The per-step rule above asks
    // the other direction -- does the step this frontmatter declares carry its tag -- and a tag
    // belonging to no step at all is invisible to it, because it only ever looks for `step.kp`.
    // An undeclared tag renders the amber `playground-unknown` panel on a slide, or a real
    // playground on a slide that never asked for one, with the gate green either way.
    {
      const declared = new Set(
        (meta.steps ?? []).filter((s) => s.kind === 'playground' && s.kp).map((s) => s.kp),
      );
      const inBody = [...body.matchAll(/<Playground\s+kp="([^"]+)"/g)].map((m) => m[1]);
      for (const kp of [...new Set(inBody)]) {
        if (!declared.has(kp)) {
          problems.push(`${file}: the body mounts <Playground kp="${kp}" />, which no step in ` +
                        `this module's frontmatter declares. Every playground is a step.`);
        }
      }
    }

    // The four-part contract, in order, in the body of a module that has a math step.
    if ((meta.steps ?? []).some((s) => s.kind === 'math')) {
      // Presence and order are two passes. One scan that looked for each part after the last
      // one found would report a part that is merely out of order as absent, which is what it
      // did when this was watched to fail: swapping Formal and Worked produced both "no
      // <Worked>" and the ordering complaint, and only the second was true.
      const at = CONTRACT.map((name) => body.indexOf(`<${name}`));
      const missing = CONTRACT.filter((_, i) => at[i] < 0);
      if (missing.length) {
        problems.push(
          `${file}: has a math step but no ${missing.map((n) => `<${n}>`).join(', ')}. ` +
            `SRS §11.2 fixes all four.`,
        );
      } else {
        for (let i = 1; i < at.length; i += 1) {
          if (at[i] < at[i - 1]) {
            problems.push(`${file}: <${CONTRACT[i]}> precedes <${CONTRACT[i - 1]}>. That order is ` +
                          `the order the professor teaches in, and SRS §11.2 fixes it.`);
          }
        }
      }
    }

    for (const claim of meta.claims ?? []) {
      for (const field of ['source', 'source_table', 'constraint', 'protocol', 'verified']) {
        if (claim[field] === undefined || claim[field] === '') {
          problems.push(`${file}: claim '${claim.id ?? '?'}' has no ${field}. A number without ` +
                        `its protocol and constraint mode is not a fact about anything.`);
        }
      }
      if (PAPERS && claim.source && !PAPERS.has(claim.source)) {
        problems.push(`${file}: claim '${claim.id}' cites '${claim.source}', not in papers.json`);
      }
    }

    for (const point of meta.knowledge_points ?? []) {
      if (!KP.has(point)) problems.push(`${file}: knowledge point '${point}' is not in kp.json`);
    }

    // A module that exists must declare what it owns. Drawing on a point another module owns is
    // fine and expected — the course cross-references itself — but a point assigned here and
    // absent from the frontmatter is a piece of the syllabus that was assigned and then dropped.
    const declared = new Set(meta.knowledge_points ?? []);
    const dropped = (owned.get(id) ?? []).filter((p) => !declared.has(p));
    if (dropped.length) {
      problems.push(`${file}: kp.json assigns ${dropped.join(', ')} to this module, but the ` +
                    `frontmatter does not list ${dropped.length > 1 ? 'them' : 'it'}`);
    }

    // Symbols are global (SRS §11.4): one notation, one meaning, across the whole corpus.
    for (const entry of meta.symbols ?? []) {
      for (const gloss of ['gloss_en', 'gloss_zh']) {
        const key = `${entry.sym}::${gloss}`;
        const seen = glosses.get(key);
        if (seen === undefined) glosses.set(key, { text: entry[gloss], file });
        else if (seen.text !== entry[gloss]) {
          problems.push(`symbol '${entry.sym}' is glossed '${seen.text}' in ${seen.file} and ` +
                        `'${entry[gloss]}' in ${file}. SRS §11.4 forbids redefining notation.`);
        }
      }
    }
  }
}

// A knowledge point has one playground, corpus-wide. Judged after every module has been walked,
// because no single module's body can see another's.
for (const [kp, steps] of [...mountedBy].sort()) {
  if (steps.size > 1) {
    problems.push(
      `'${kp}' is mounted by ${steps.size} playground steps: ${[...steps].sort().join(', ')}. ` +
        `Contracts §2.4 gives a knowledge point one playground.`,
    );
  }
}

// ---- X1's release figures, rule 12 ----------------------------------------
// Every figure X1 displays is a transcription, never a recollection: it names where it was read
// and carries the sentence, and a count must equal one whole number of that sentence, which
// catches `68583` typed for "68 538" without anyone re-reading the card. When the sentence holds
// several numbers -- a table row, "57,723 / 5,000 / 26,446" -- the figure says which one it is by
// `index`, so a figure read from the wrong column fails. Until 2026-09-26 this compared the value
// against every digit of the quote run together, which passed a wrong column and a number
// straddling two others (D94). A null is a figure the source does not state, and it still
// carries the passage that does not state it.
const SPLITS_FILE = '../data/content/vg150_splits.json';
const SPLITS = existsSync(SPLITS_FILE) ? JSON.parse(readFileSync(SPLITS_FILE, 'utf-8')) : null;
/** The whole numbers of a quote, thousands separated by a comma or a single space ("68 538"). */
const numbersOf = (text) =>
  (String(text).match(/\d{1,3}(?:[ ,]\d{3})+(?!\d)|\d+/g) ?? []).map((n) => Number(n.replace(/[ ,]/g, '')));
const CODED = { val_from: ['trainval', 'test'], zero_relation: ['kept', 'dropped'] };
const REQUIRED_FIGURES = ['train', 'val', 'test', 'val_from', 'zero_relation'];
let releaseFigures = 0;
function citedFigure(where, f, name) {
  releaseFigures += 1;
  for (const key of ['source', 'url', 'locator', 'quote']) {
    if (typeof f?.[key] !== 'string' || f[key].trim() === '') {
      problems.push(`${where}: no '${key}'. X1 shows where every figure was read (NFR-2).`);
    }
  }
  if (typeof f?.value === 'number') {
    const numbers = numbersOf(f.quote ?? '');
    if (!numbers.includes(f.value)) {
      problems.push(
        `${where}: value ${f.value} does not appear in its quote. A figure is copied, not recalled.`,
      );
    } else if (numbers.length > 1 && f.index === undefined) {
      problems.push(
        `${where}: its quote holds ${numbers.length} numbers; 'index' must say which one the figure is`,
      );
    } else if (f.index !== undefined && numbers[f.index - 1] !== f.value) {
      problems.push(`${where}: index ${f.index} names ${numbers[f.index - 1]}, not ${f.value}`);
    }
  } else if (typeof f?.value === 'string' && !CODED[name] && !String(f.quote ?? '').includes(f.value)) {
    // A share ("70%") has no whole number to match, so it is matched as written. A coded value
    // is this file's vocabulary, not the source's, and is checked against its set below.
    problems.push(`${where}: '${f.value}' does not appear in its quote. A figure is copied, not recalled.`);
  }
  if (CODED[name] && f?.value !== null && !CODED[name].includes(f?.value)) {
    problems.push(`${where}: '${f?.value}' is not one of ${CODED[name].join(', ')}, or null`);
  }
  if (f?.measured !== undefined && f.measured.rows !== f.value) {
    problems.push(`${where}: measured ${f.measured.rows} rows but carries ${f.value}`);
  }
}
if (!SPLITS) {
  problems.push('vg150_splits.json: missing. X1 reads every figure it shows from it.');
} else {
  if (SPLITS.$schema_version !== 1) problems.push('vg150_splits.json: unknown schema version');
  if (!Array.isArray(SPLITS.releases) || SPLITS.releases.length === 0) {
    problems.push('vg150_splits.json: no releases');
  }
  for (const r of SPLITS.releases ?? []) {
    for (const key of ['label_en', 'label_zh']) {
      if (typeof r[key] !== 'string' || r[key].trim() === '') problems.push(`${r.id}: no '${key}'`);
    }
    // Every release states every figure, or says it is not stated: a key left out rendered
    // "not stated by the source" with no source at all behind the claim.
    for (const key of REQUIRED_FIGURES) {
      if (!(key in (r.figures ?? {}))) {
        problems.push(`${r.id}: no '${key}'. A figure the source does not state is null, with its passage.`);
      }
    }
    for (const [name, f] of Object.entries(r.figures ?? {})) citedFigure(`${r.id}.${name}`, f, name);
    for (const [i, n] of (r.notes ?? []).entries()) {
      const where = `${r.id}.notes[${i}]`;
      citedFigure(where, n);
      if (typeof n.value !== 'number') problems.push(`${where}: a note needs a numeric value`);
      // X1 explains a difference only with a note about the same split, so a magnitude that
      // recurs on another split cannot borrow a sentence written about this one.
      if (!['train', 'val', 'test'].includes(n.split)) {
        problems.push(`${where}: 'split' must be one of train, val, test`);
      }
      for (const key of ['text_en', 'text_zh']) {
        if (typeof n[key] !== 'string' || n[key].trim() === '') problems.push(`${where}: no '${key}'`);
      }
    }
  }
}

// ---- report ---------------------------------------------------------------
if (problems.length) {
  console.error(`content lint: ${problems.length} problem(s)\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(
  `content lint: ${golden.cases.length} golden cases, ` +
    // Counted, so a green run says the playground file was read. It was checked and not
    // counted, which reads to the person watching CI as though it were not checked.
    `${PLAYGROUND_GOLDEN.cases.length} playground cases, ${releaseFigures} release figures, ` +
    `${gates.size} licence rows, ` +
    `${modules.size} of ${owned.size} modules x ${LOCALES.length} locales, ` +
    `${POINTS.length} knowledge points all assigned, ${glosses.size / 2} symbols, clean`,
);
