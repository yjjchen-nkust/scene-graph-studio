import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// The checker is machinery and lives under system/ so it can resolve its dev
// dependencies; the mockup it checks is a document and stays in docs/mockup/.
// Resolved against this file so the caller's CWD does not matter.
const HERE = dirname(fileURLToPath(import.meta.url));
import { JSDOM } from 'jsdom';

const html = readFileSync(join(HERE, '../../../docs/mockup/index.html'), 'utf-8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;
// The page scrolls to the top when a nav item is clicked. jsdom implements no `scrollTo` and
// answers the call by printing `Error: Not implemented` with a stack trace, so a passing gate
// carried an error in its log on every run -- which is how a real one gets read past. Nothing
// here asserts scroll position; the same-realm no-op is the smallest thing that is honest about
// that, in the manner of the `BroadcastChannel` stub in frontend/test/setup.ts.
window.scrollTo = () => {};
await new Promise((r) => setTimeout(r, 300));
const { document } = window;
const cs = (el) => window.getComputedStyle(el).display;

const checks = [];
checks.push(['<html> not hidden', cs(document.documentElement) !== 'none']);
checks.push(['<body> not hidden', cs(document.body) !== 'none']);

const zh = document.querySelector('body span[lang="zh"]');
const en = document.querySelector('body span[lang="en"]');
checks.push(['data-lang is zh at load', document.documentElement.getAttribute('data-lang') === 'zh']);
checks.push(['zh span visible', cs(zh) !== 'none']);
checks.push(['en span hidden', cs(en) === 'none']);

document.getElementById('lang-en').click();
checks.push(['after toggle: en visible', cs(en) !== 'none']);
checks.push(['after toggle: zh hidden', cs(zh) === 'none']);
checks.push(['after toggle: html still visible', cs(document.documentElement) !== 'none']);

const nav = document.getElementById('nav');
checks.push(['nav built', nav.children.length === 8]);
const overview = document.getElementById('s-overview');
checks.push(['first screen shown', overview.classList.contains('on')]);
checks.push(['other screens hidden', cs(document.getElementById('s-labs')) === 'none']);

window.location.hash = '#s-labs';
window.dispatchEvent(new window.HashChangeEvent('hashchange'));
checks.push(['nav switches screen', document.getElementById('s-labs').classList.contains('on')]);

const text = document.body.textContent.replace(/\s+/g, ' ').trim();
checks.push(['body has content', text.length > 2000]);

let bad = 0;
for (const [name, ok] of checks) {
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}
console.log(`\nvisible text: ${text.length} chars`);
process.exit(bad ? 1 : 0);
