// Coverage rules for the subsystem index (docs/subsystems/).
//
// Holds the index complete: every deviation, verification section, decision,
// spec and plan is cited by a page (R1 to R4), every citation resolves (R5,
// R6), every tracked file has an owning prefix (R7), and every page carries
// the same eight headings in order (R8). The module is a pure function of a
// Tree; only loadTree and trackedFiles touch the disk, and nothing runs at
// module scope. Every parser normalises CRLF first, because working copies
// here are checked out with core.autocrlf=true.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {object} Tree
 * @property {{file: string, text: string}[]} pages docs/subsystems/S??-*.md, sorted by name
 * @property {string} map docs/subsystems/README.md, or '' when absent
 * @property {string} deviations DEVIATIONS.md
 * @property {string} verification docs/VERIFICATION.md
 * @property {string} decisions the decisions document
 * @property {{contracts: string, SRS: string, design: string, PRD: string}} sectioned
 * @property {string[]} records base names of the specs and plans
 * @property {string[]} tracked git-tracked paths
 * @property {(path: string) => boolean} exists repository-root-relative existence test
 */

export const HEADINGS = [
  '## 1. Purpose and boundary',
  '## 2. Code and data',
  '## 3. Interfaces',
  '## 4. Current rules',
  '## 5. Verification',
  '## 6. Traps',
  '## 7. History',
  '## 8. Open items',
];

export const EXEMPT = ['docs/', 'CLAUDE.md', 'README.md', 'DEVIATIONS.md'];

const PATH_ROOTS = ['system/', 'fixtures/', 'docs/', '.github/', '.claude/', 'data/'];

/** @param {string} text @returns {string} the text with CRLF replaced by LF */
export function normalise(text) {
  return text.replaceAll('\r\n', '\n');
}

/** @param {string} text @returns {number[]} N of every `## D<N>` heading */
export function deviationIds(text) {
  return [...normalise(text).matchAll(/^## D(\d+)\b/gm)].map((m) => Number(m[1]));
}

/** @param {string} text @returns {number[]} N of every `## <N>. ` heading */
export function verificationIds(text) {
  return [...normalise(text).matchAll(/^## (\d+)\. /gm)].map((m) => Number(m[1]));
}

/** @param {string} text @returns {number[]} NN of every `## D-<NN> ` heading */
export function decisionIds(text) {
  return [...normalise(text).matchAll(/^## D-(\d{2}) /gm)].map((m) => Number(m[1]));
}

/** @param {string} text @returns {Set<string>} section ids such as 4, 4.3 and 1.4a */
export function sectionIds(text) {
  return new Set(
    [...normalise(text).matchAll(/^#{2,4} (\d+(?:\.\d+)*[a-z]?)[.\s]/gm)].map((m) => m[1]),
  );
}

/**
 * @param {string} text
 * @returns {{deviations: Set<number>, decisions: Set<number>, verification: Set<number>,
 *   sections: {doc: 'contracts'|'SRS'|'design'|'PRD', id: string}[],
 *   records: Set<string>, paths: Set<string>}}
 */
export function citations(text) {
  const t = normalise(text);
  const out = {
    deviations: new Set(),
    decisions: new Set(),
    verification: new Set(),
    sections: [],
    records: new Set(),
    paths: new Set(),
  };
  for (const m of t.matchAll(/(?<![\w:-])D(\d{1,3})(?![\w-])/g)) out.deviations.add(Number(m[1]));
  for (const m of t.matchAll(/(?<![\w:-])D-(\d{2})(?!\d)/g)) out.decisions.add(Number(m[1]));
  for (const m of t.matchAll(/VERIFICATION §(\d+)/g)) out.verification.add(Number(m[1]));
  for (const m of t.matchAll(/\b(contracts|SRS|design|PRD) §(\d+(?:\.\d+)*[a-z]?)/g)) {
    out.sections.push({ doc: m[1], id: m[2] });
  }
  for (const m of t.matchAll(/`([^`\n]+)`/g)) {
    const token = m[1];
    const name = token.slice(token.lastIndexOf('/') + 1);
    if (/^\d{4}-\d{2}-\d{2}-.+\.md$/.test(name)) out.records.add(name);
    if (PATH_ROOTS.some((root) => token.startsWith(root))) {
      out.paths.add(token.replace(/:\d+(-\d+)?$/, '').replace(/\/$/, ''));
    }
  }
  return out;
}

/** @param {string} mapText @returns {{prefix: string, id: string}[]} the path ownership rows */
export function ownership(mapText) {
  const t = normalise(mapText);
  const start = t.indexOf('## Path ownership');
  if (start < 0) return [];
  const rest = t.slice(start + '## Path ownership'.length);
  const next = rest.search(/^## /m);
  const body = next < 0 ? rest : rest.slice(0, next);
  return [...body.matchAll(/^\| `([^`]*)` \| (S\d{1,2}) \|/gm)].map((m) => ({
    prefix: m[1],
    id: m[2],
  }));
}

const pagesCited = (tree) => tree.pages.map((p) => citations(p.text));

const isRoot = (prefix) => ['', '/', './'].includes(prefix);

const isExempt = (path) => EXEMPT.some((e) => path.startsWith(e));

function r1(tree) {
  const cited = new Set(pagesCited(tree).flatMap((c) => [...c.deviations]));
  return deviationIds(tree.deviations)
    .filter((n) => !cited.has(n))
    .map((n) => `D${n}: cited by no subsystem page`);
}

function r2(tree) {
  const cited = new Set(pagesCited(tree).flatMap((c) => [...c.verification]));
  return verificationIds(tree.verification)
    .filter((n) => !cited.has(n))
    .map((n) => `VERIFICATION §${n}: cited by no subsystem page`);
}

function r3(tree) {
  const cited = new Set(pagesCited(tree).flatMap((c) => [...c.records]));
  return tree.records
    .filter((name) => !cited.has(name))
    .map((name) => `${name}: cited by no subsystem page`);
}

function r4(tree) {
  const cited = new Set(
    [...pagesCited(tree), citations(tree.map)].flatMap((c) => [...c.decisions]),
  );
  return decisionIds(tree.decisions)
    .filter((n) => !cited.has(n))
    .map((n) => `D-${String(n).padStart(2, '0')}: cited by no subsystem page and not by the map`);
}

function r5(tree) {
  const deviations = new Set(deviationIds(tree.deviations));
  const decisions = new Set(decisionIds(tree.decisions));
  const verification = new Set(verificationIds(tree.verification));
  const sections = Object.fromEntries(
    Object.entries(tree.sectioned).map(([doc, text]) => [doc, sectionIds(text)]),
  );
  const records = new Set(tree.records);
  const problems = [];
  for (const { file, text } of tree.pages) {
    const c = citations(text);
    const dangling = (token) => problems.push(`${file}: ${token} resolves to nothing`);
    for (const n of c.deviations) if (!deviations.has(n)) dangling(`D${n}`);
    for (const n of c.decisions) {
      if (!decisions.has(n)) dangling(`D-${String(n).padStart(2, '0')}`);
    }
    for (const n of c.verification) if (!verification.has(n)) dangling(`VERIFICATION §${n}`);
    for (const { doc, id } of c.sections) {
      if (!sections[doc].has(id)) dangling(`${doc} §${id}`);
    }
    for (const name of c.records) if (!records.has(name)) dangling(name);
  }
  return problems;
}

function r6(tree) {
  const problems = [];
  for (const { file, text } of tree.pages) {
    for (const path of citations(text).paths) {
      if (path.startsWith('data/') || /[*…< ]/.test(path)) continue;
      if (!tree.exists(path)) problems.push(`${file}: ${path} does not exist`);
    }
  }
  return problems;
}

function r7(tree) {
  const rows = ownership(tree.map);
  const prefixes = rows.map((r) => r.prefix);
  const owners = prefixes.filter((p) => !isRoot(p));
  const problems = [];
  for (const path of tree.tracked) {
    if (isExempt(path)) continue;
    if (!owners.some((p) => path.startsWith(p))) problems.push(`${path}: owned by no prefix`);
  }
  const seen = new Set();
  for (const prefix of prefixes) {
    if (isRoot(prefix)) {
      problems.push(`${prefix}: an empty or root prefix owns everything`);
    } else if (seen.has(prefix)) {
      problems.push(`${prefix}: listed twice`);
    } else if (!tree.tracked.some((path) => path.startsWith(prefix))) {
      problems.push(`${prefix}: matches no tracked file`);
    }
    seen.add(prefix);
  }
  return problems;
}

function r8(tree) {
  const problems = [];
  for (const { file, text } of tree.pages) {
    const lines = normalise(text).split('\n');
    const n = parseInt(file.slice(1, 3), 10);
    const title = lines.find((l) => l.trim() !== '') ?? '';
    if (!title.startsWith(`# S${n} `)) problems.push(`${file}: title is not "# S${n} …"`);
    let previous = -1;
    for (const heading of HEADINGS) {
      const at = lines.findIndex((l) => l.trimEnd() === heading);
      if (at < 0) {
        problems.push(`${file}: missing "${heading}"`);
        continue;
      }
      if (at < previous) problems.push(`${file}: "${heading}" out of order`);
      previous = Math.max(previous, at);
    }
  }
  return problems;
}

export const RULES = { R1: r1, R2: r2, R3: r3, R4: r4, R5: r5, R6: r6, R7: r7, R8: r8 };

/** @param {Tree} tree @returns {{rule: string, message: string}[]} problems, ordered R1 to R8 */
export function check(tree) {
  return Object.entries(RULES).flatMap(([rule, fn]) =>
    fn(tree).map((message) => ({ rule, message })),
  );
}

/** @param {string} repoRoot @returns {string[]} tracked paths, exactly as named on disk */
export function trackedFiles(repoRoot) {
  const out = execFileSync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.split('\0').filter((f) => f !== '');
}

/** @param {string} repoRoot @returns {Tree} */
export function loadTree(repoRoot) {
  const read = (rel) => {
    const full = join(repoRoot, rel);
    return existsSync(full) ? normalise(readFileSync(full, 'utf8')) : '';
  };
  const list = (rel) => {
    const full = join(repoRoot, rel);
    return existsSync(full) ? readdirSync(full).sort() : [];
  };
  const specs = 'docs/superpowers/specs';
  const spec = (name) => read(`${specs}/2026-09-15-scene-graph-studio-${name}.md`);
  return {
    pages: list('docs/subsystems')
      .filter((f) => /^S\d\d-.*\.md$/.test(f))
      .map((file) => ({ file, text: read(`docs/subsystems/${file}`) })),
    map: read('docs/subsystems/README.md'),
    deviations: read('DEVIATIONS.md'),
    verification: read('docs/VERIFICATION.md'),
    decisions: spec('decisions'),
    sectioned: {
      contracts: spec('contracts'),
      SRS: spec('SRS'),
      design: spec('design'),
      PRD: spec('PRD'),
    },
    records: [...list(specs), ...list('docs/superpowers/plans')].filter((f) => f.endsWith('.md')),
    tracked: trackedFiles(repoRoot),
    exists: (path) => existsSync(join(repoRoot, path)),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = check(loadTree(resolve(import.meta.dirname, '../..')));
  for (const { rule, message } of problems) process.stdout.write(`${rule} ${message}\n`);
  process.stdout.write(`docs_index: ${problems.length} problems\n`);
  if (problems.length > 0) process.exitCode = 1;
}
