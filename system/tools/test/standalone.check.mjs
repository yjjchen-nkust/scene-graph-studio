// The standalone brief must render identically with no network. Asserted, not assumed.
//
// The original fetches MathJax from cdnjs and fonts from Google. This build pre-renders every
// equation to SVG and drops both. The failure this guards against is silent: the page still
// loads, and the mathematics shows as raw LaTeX to whoever you sent it to.
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const FILE = '../docs/brief.standalone.html';
const html = readFileSync(FILE, 'utf-8');
const checks = [];

// doi.org and arxiv.org are citations a reader clicks, not resources the page fetches.
// Kept in step with the same allowlist in tools/build_standalone.mjs.
const remote = [...html.matchAll(/(?:src|href)\s*=\s*"(https?:\/\/[^"]+)"/g)]
  .map((m) => m[1])
  .filter((u) => !u.startsWith('https://doi.org/') && !u.startsWith('https://arxiv.org/'));
checks.push(['no network requests', remote.length === 0, remote.join(', ')]);
checks.push(['MathJax runtime removed', !html.includes('MathJax-script')]);
checks.push(['webfont link removed', !html.includes('fonts.googleapis.com')]);

const rawDisplay = (html.match(/\\\[/g) || []).length;
const rawInline = (html.match(/\\\(/g) || []).length;
checks.push(['no unrendered display math', rawDisplay === 0, String(rawDisplay)]);
checks.push(['no unrendered inline math', rawInline === 0, String(rawInline)]);

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;
await new Promise((r) => setTimeout(r, 400));
const { document } = window;

const blocks = document.querySelectorAll('.mjx-block svg');
const inlines = document.querySelectorAll('.mjx-inline svg');
checks.push(['display equations present', blocks.length >= 15, String(blocks.length)]);
checks.push(['inline equations present', inlines.length >= 50, String(inlines.length)]);
checks.push([
  'glyphs are inline paths, not defs references',
  document.querySelectorAll('.mjx-block svg path').length > 100,
]);

// The prototype is the part of the brief a reader is meant to touch. It must still work.
const k = document.getElementById('kslider');
const gc = document.getElementById('gcon');
checks.push(['prototype mounted', !!k && !!gc]);
checks.push(['scene drawn', document.querySelectorAll('#scene rect').length > 5]);
checks.push(['graph drawn', document.querySelectorAll('#graph path').length > 5]);

const rBefore = document.getElementById('rk').textContent;
gc.checked = false;
gc.dispatchEvent(new window.Event('change'));
k.value = '20';
k.dispatchEvent(new window.Event('input'));
const rAfter = document.getElementById('rk').textContent;
checks.push(['constraint toggle moves R', rBefore !== rAfter, `${rBefore} -> ${rAfter}`]);

// The figure caption states these two numbers in prose. If the prototype ever stops producing
// them the caption becomes a false claim, which is worse than a broken widget.
checks.push(['R reaches the caption value 0.800', rAfter === '0.800', rAfter]);
const mr = document.getElementById('mrk').textContent;
checks.push(['mR overtakes R, as the caption claims', mr === '0.810', mr]);

document.getElementById('lang-zh').click();
checks.push(['zh toggle works', document.documentElement.getAttribute('data-lang') === 'zh']);
checks.push([
  'body has content',
  document.body.textContent.replace(/\s+/g, ' ').length > 8000,
]);

let bad = 0;
for (const [name, ok, extra] of checks) {
  if (!ok) bad += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`);
}
console.log(`\n${(html.length / 1024).toFixed(0)} KB, self-contained`);
process.exit(bad ? 1 : 0);
