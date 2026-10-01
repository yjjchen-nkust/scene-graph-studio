// The harvested LaTeX for one knowledge point, in the delimiters MDX reads.
//
// The frozen page wrote display mathematics as `\[ ... \]`; `remark-math` reads `$$ ... $$`.
// Nothing else changes. Plan 02 Task 8 says verbatim and means it: the harvested LaTeX was
// audited by `tools/audit.js` for the stray-backslash line break that MathJax renders as a
// visible red error, and re-typing a formula puts that back on the table. So the delimiters are
// swapped mechanically and the body is copied byte for byte.
//
// Usage:  node tools/kp_latex.mjs E3           both blocks
//         node tools/kp_latex.mjs E3 math      the formula alone
//         node tools/kp_latex.mjs E3 deriv 1   the second derivation block
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const MATH = JSON.parse(readFileSync('../data/content/math.json', 'utf-8'));
const DERIV = JSON.parse(readFileSync('../data/content/deriv.json', 'utf-8'));

/** Split a harvested string into its display blocks and re-delimit each one. */
export function blocks(raw) {
  if (!raw) return [];
  const out = [];
  let at = 0;
  for (;;) {
    const open = raw.indexOf('\\[', at);
    if (open < 0) break;
    const close = raw.indexOf('\\]', open);
    if (close < 0) break;
    out.push(raw.slice(open + 2, close).trim());
    at = close + 2;
  }
  return out;
}

export function mathOf(id) {
  return blocks(MATH[id]);
}

export function derivOf(id) {
  return blocks(DERIV[id]);
}

/** `$$\n...\n$$`, which is what an MDX body wants around a display formula. */
export function display(body) {
  return `$$\n${body}\n$$`;
}

// `pathToFileURL`, as `py.mjs` does: `file://` and a Windows path make `file://C:/…`, never this
// module's `file:///C:/…`, and the command printed nothing there and exited 0.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [id, which, index] = process.argv.slice(2);
  const pick = which === 'deriv' ? derivOf(id) : which === 'math' ? mathOf(id) : [...mathOf(id), ...derivOf(id)];
  const chosen = index === undefined ? pick : [pick[Number(index)]];
  for (const body of chosen) {
    if (body === undefined) continue;
    process.stdout.write(display(body) + '\n\n');
  }
}
