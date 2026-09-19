const fs = require('fs');
const path = require('path');
process.chdir(__dirname);
const KM = '../web/knowledge-map/';
const BR = '../web/brief/';

const ENVS = ['aligned', 'gathered', 'array', 'cases', 'matrix', 'pmatrix', 'bmatrix',
              'split', 'alignedat', 'smallmatrix', 'subarray'];

/* Does this display-math body contain a `\\` that sits outside every environment? */
function strayBreaks(body) {
  let depth = 0, stray = 0;
  for (let i = 0; i < body.length; i++) {
    if (body.startsWith('\\begin{', i)) {
      const e = body.slice(i + 7, body.indexOf('}', i + 7));
      if (ENVS.includes(e)) depth++;
      i += 6; continue;
    }
    if (body.startsWith('\\end{', i)) {
      const e = body.slice(i + 5, body.indexOf('}', i + 5));
      if (ENVS.includes(e)) depth--;
      i += 4; continue;
    }
    if (body[i] === '\\' && body[i + 1] === '\\') {
      if (depth === 0) stray++;
      i++; continue;          // consume both
    }
    if (body[i] === '\\') i++; // skip any escaped char
  }
  return stray;
}

/* Pull every \[ ... \] display block out of a source string. */
function displayBlocks(src) {
  const out = [];
  let i = 0;
  while (true) {
    const a = src.indexOf('\\[', i);
    if (a < 0) break;
    if (a > 0 && src[a - 1] === '\\') { i = a + 2; continue; }  // this is \\[  = a line break
    const b = src.indexOf('\\]', a + 2);
    if (b < 0) { out.push({ start: a, body: src.slice(a + 2), unterminated: true }); break; }
    out.push({ start: a, body: src.slice(a + 2, b) });
    i = b + 2;
  }
  return out;
}

const problems = [];
const note = (where, msg) => problems.push(`${where}: ${msg}`);

/* Everything an HTML page is checked for, so both pages get the same treatment.
   The brief was unaudited until 16 Sep 2026 despite carrying 13 display blocks. */
function auditPage(label, html) {
  displayBlocks(html).forEach((blk, n) => {
    if (blk.unterminated) note(label, `display block #${n} unterminated`);
    const s = strayBreaks(blk.body);
    if (s) note(label, `display block #${n} has ${s} stray \\\\ outside an environment — "${blk.body.slice(0, 60).trim()}…"`);
  });

  const io_ = html.split('\\(').length - 1, ic = html.split('\\)').length - 1;
  if (io_ !== ic) note(label, `inline math unbalanced: \\( ${io_} vs \\) ${ic}`);

  const body = html.slice(html.indexOf('</style>'));   // CSS selectors carry lang="zh"
  for (const tag of ['section', 'div', 'table', 'details', 'dl']) {
    const o = (body.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
    const c = (body.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (o !== c) note(label, `<${tag}> ${o} open vs ${c} close`);
  }

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) note(label, 'duplicate ids: ' + [...new Set(dup)].join(', '));

  const en = (body.match(/lang="en"/g) || []).length;
  const zh = (body.match(/lang="zh"/g) || []).length;
  if (en !== zh) note(label, `lang spans unbalanced: en=${en} zh=${zh}`);
}

/* ── 1. the two HTML pages ── */
const html = fs.readFileSync(KM + 'index.html', 'utf8');
auditPage('knowledge-map/index.html', html);
auditPage('brief/index.html', fs.readFileSync(BR + 'index.html', 'utf8'));

/* ── 2. LaTeX in the playground maps ── */
const pg = fs.readFileSync(KM + 'pg.js', 'utf8');
const grab = (name) => {
  const m = pg.match(new RegExp('var ' + name + '=\\{[\\s\\S]*?\\n\\};'));
  if (!m) throw new Error('cannot find ' + name + ' in pg.js');
  return new Function('return ' + m[0].replace(new RegExp('^var ' + name + '='), '').replace(/;$/, ''))();
};
for (const [mapName, map] of [['MATH', grab('MATH')], ['DERIV', grab('DERIV')]]) {
  for (const [k, v] of Object.entries(map)) {
    const blks = displayBlocks(v);
    if (!blks.length) note(`${mapName}.${k}`, 'no display block found');
    blks.forEach((blk, n) => {
      if (blk.unterminated) note(`${mapName}.${k}`, `block #${n} unterminated`);
      const s = strayBreaks(blk.body);
      if (s) note(`${mapName}.${k}`, `block #${n} has ${s} stray \\\\ outside an environment`);
    });
  }
}

/* ── 3. classes used but never styled ── */
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const styled = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
const usedHtml = [...html.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/));
const usedJs = [...(pg + fs.readFileSync(KM + 'imagelab.js', 'utf8')).matchAll(/class="([^"]+)"/g)]
  .flatMap(m => m[1].split(/\s+/)).filter(c => !c.includes("'") && !c.includes('+'));
const unstyled = [...new Set([...usedHtml, ...usedJs])].filter(c => c && !styled.has(c));
if (unstyled.length) note('css', 'classes used but not styled: ' + unstyled.join(', '));

/* ── 4. the playground control surface is bilingual ──
   Control labels, option labels, readout keys, hints and literal verdicts are prose
   and must swap with the toggle. KEEP lists the strings deliberately identical in
   both languages: notation, metric names, protocol names, and the VG150 class
   vocabulary itself. Anything in neither ZH nor KEEP would render English-only
   inside Chinese, which is the defect this check exists to prevent. */
const KEEP = new Set([
  // notation and metric names
  'IoU', 'K', 'R', 'R@', 'R@20', 'R@100', 'mR', 'mR@', 'mR@20', 'mR@100',
  'ngR@20', 'mNgR@20', 'p', 'O', 'O + P', 'O + P + E', '|E| over T', '+',
  'k = 1', 'k = 10', 'k = 70', 'N = ', 'τ = ', '0 / 5', '5 / 5', '0.032', '23.040',
  'SGDet ≤ SGCls ≤ PredCls',
  'IoU(subject) ≥ τ', 'IoU(object) ≥ τ', 'IoU(ŝ,s) ≥ τ', 'IoU(ô,o) ≥ τ',
  'c_ŝ = c_s', 'c_ô = c_o', 'p̂ = p',
  // protocol, split and method names
  'MultiMPO', 'SingleMPO', 'protocol', 'predicate',
  'PredCls', 'SGCls', 'SGDet', 'SGG-Bench', 'Tang',
  // VG150 class and predicate vocabulary — the object of study, never translated
  'box', 'conveyor', 'glove', 'laptop', 'person', 'robot arm', 'table', 'wrench', 'arm',
  'on', 'above', 'near', 'holding',
]);
const ZH = grab('ZH');
const STR = "'((?:[^'\\\\]|\\\\.)*)'";
const uiStrings = new Set();
const addUi = (s) => { if (s && !s.startsWith('<') && !s.startsWith('var(--')) uiStrings.add(s); };
for (const m of pg.matchAll(new RegExp('\\blabel:' + STR, 'g'))) addUi(m[1]);
for (const m of pg.matchAll(new RegExp("\\['(?:[^'\\\\]|\\\\.)*'," + STR + '\\]', 'g'))) addUi(m[1]);
for (const m of pg.matchAll(new RegExp('\\{k:' + STR, 'g'))) addUi(m[1]);
for (const m of pg.matchAll(new RegExp('\\bs:' + STR, 'g'))) addUi(m[1]);
for (const m of pg.matchAll(new RegExp('\\bv:[^,}]*?\\?' + STR + ':' + STR, 'g'))) { addUi(m[1]); addUi(m[2]); }
const untranslated = [...uiStrings].filter(s => !ZH[s] && !KEEP.has(s)).sort();
if (untranslated.length)
  note('i18n', `UI strings in neither ZH nor KEEP: ${untranslated.map(s => JSON.stringify(s)).join(', ')}`);
/* The reverse direction is deliberately NOT enforced. Several strings reach uiT()
   through shapes this scan cannot see — nested ternaries, lookup maps indexed at
   render time, raw HTML built inside draw() — so an unreferenced ZH entry is not
   evidence of dead weight. The forward check is the one that prevents the defect. */

console.log(problems.length ? 'PROBLEMS (' + problems.length + ')\n  ' + problems.join('\n  ') : 'no problems found');
process.exit(problems.length ? 1 : 0);
