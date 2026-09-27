// Harvest the knowledge map into the seed corpus the module content is built from.
//
// The page was frozen by D-13 and released by D-23; it remains the source of what this takes.
// Its knowledge-point inventory, its MATH map and its DERIV map are the only things taken; everything else on that page is presentation, and one thing on it is a
// trap.
//
// **`pg.js evaluate()` is deliberately not harvested (D-14).** It is a teaching instrument over
// fifteen hard-coded prediction rows: it matches on string equality against a precomputed IoU
// scalar, carries no protocol and no constraint mode, and its weighting dial is a pedagogical
// interpolation rather than a published metric. Promoting it would ship something plausible and
// wrong in a way the cross-implementation parity check could not detect, because both sides would
// be wrong together. The real engine is backend/app/eval/ and its TypeScript mirror.
//
// Extraction reads the two sources as *text* and evaluates only their data declarations inside a
// node:vm context with no globals. pg.js is a browser script: it ends in immediately-invoked
// functions that touch document, localStorage and MathJax. Importing it would run them. Slicing
// out the three declarations and evaluating those alone is what keeps this a data extraction
// rather than a page load.
//
// Paths are relative to system/, where npm runs. data/ stayed at the track root.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = 'web/knowledge-map';
const OUT = '../data/content';

function skipString(text, start) {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i += 1) {
    if (text[i] === '\\') { i += 1; continue; }
    if (text[i] === quote) return i;
  }
  throw new Error('unterminated string literal');
}

function matchDelimiter(text, open) {
  const pairs = { '[': ']', '{': '}' };
  const close = pairs[text[open]];
  if (!close) throw new Error(`not a delimiter at ${open}: ${text[open]}`);
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    // A brace inside a string literal is not a brace. MATH and DERIV are full of them.
    if (ch === '"' || ch === "'") { i = skipString(text, i); continue; }
    if (ch === text[open]) depth += 1;
    else if (ch === close) { depth -= 1; if (depth === 0) return i; }
  }
  throw new Error('unbalanced delimiter');
}

function extract(file, names) {
  const text = readFileSync(`${SRC}/${file}`, 'utf-8');
  const picked = names.map((name) => {
    let start = -1;
    for (const form of [`const ${name}=`, `const ${name} =`, `var ${name}=`, `var ${name} =`]) {
      start = text.indexOf(form);
      if (start >= 0) break;
    }
    if (start < 0) throw new Error(`${name} not found in ${file}`);
    const eq = text.indexOf('=', start);
    let open = eq + 1;
    while (text[open] === ' ' || text[open] === '\n' || text[open] === '\r') open += 1;
    return `const ${name} = ${text.slice(open, matchDelimiter(text, open) + 1)};`;
  }).join('\n');

  // No globals at all: if a declaration ever starts referring to something outside itself,
  // this throws rather than silently harvesting a half-evaluated object.
  const context = vm.createContext(Object.create(null));
  vm.runInContext(`${picked}\nresult = { ${names.join(', ')} };`, context);
  return context.result;
}

const { CLUSTERS } = extract('kp-data.js', ['CLUSTERS']);
const { MATH, DERIV } = extract('pg.js', ['MATH', 'DERIV']);

const kp = CLUSTERS.flatMap((c) =>
  c.kps.map(([id, en, zh, knobs, status]) => ({
    id,
    cluster: c.id,
    cluster_en: c.en,
    cluster_zh: c.zh,
    title_en: en,
    title_zh: zh,
    knobs,
    status,
    ...(MATH[id] ? { math: MATH[id] } : {}),
    ...(DERIV[id] ? { deriv: DERIV[id] } : {}),
  })));

// Fail loudly rather than write a corpus that is quietly wrong. These numbers are asserted
// against the page itself by tools/check.js, so a mismatch means the harvest drifted.
const live = kp.filter((k) => k.status === 'live').length;
const problems = [];
if (kp.length !== 93) problems.push(`expected 93 knowledge points, harvested ${kp.length}`);
if (new Set(kp.map((k) => k.cluster)).size !== 12) problems.push('expected 12 clusters');
if (live !== 27) problems.push(`expected 27 live points, harvested ${live}`);
const ids = new Set(kp.map((k) => k.id));
for (const id of [...Object.keys(MATH), ...Object.keys(DERIV)]) {
  if (!ids.has(id)) problems.push(`${id} has a formula but no knowledge point`);
}
if (problems.length) {
  console.error('harvest refused:\n  ' + problems.join('\n  '));
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/kp.json`, `${JSON.stringify(kp, null, 2)}\n`);
writeFileSync(`${OUT}/math.json`, `${JSON.stringify(MATH, null, 2)}\n`);
writeFileSync(`${OUT}/deriv.json`, `${JSON.stringify(DERIV, null, 2)}\n`);
console.log(
  `harvested ${kp.length} knowledge points (${live} live) across ` +
  `${new Set(kp.map((k) => k.cluster)).size} clusters, ` +
  `${Object.keys(MATH).length} formulas, ${Object.keys(DERIV).length} derivations`,
);
