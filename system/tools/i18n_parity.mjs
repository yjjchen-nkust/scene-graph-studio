// NFR-6: a key must exist in both locales, or neither. There is no fallback locale, so a
// missing key is a visible defect in one language and an invisible one in the other. The same
// holds for a placeholder (D103). tools/test/i18n_parity.test.mjs shows each rule failing.
import { readFileSync } from 'node:fs';

const LOCALES = ['zh-TW', 'en'];
const tables = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(`frontend/src/i18n/${l}.json`, 'utf-8'))]),
);

const problems = [];
for (const a of LOCALES) {
  for (const b of LOCALES) {
    if (a === b) continue;
    for (const key of Object.keys(tables[a])) {
      if (!(key in tables[b])) problems.push(`${key}: present in ${a}, missing from ${b}`);
    }
  }
}
for (const [locale, table] of Object.entries(tables)) {
  for (const [key, value] of Object.entries(table)) {
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`${key}: empty or non-string value in ${locale}`);
    }
  }
}

// A placeholder is filled by String.replace, so each locale must carry the same ones, each the
// same number of times; a translation that drops or repeats one prints wrong in that locale only.
const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => `{${m[1]}}`).sort();
for (const [key, en] of Object.entries(tables['en'])) {
  const zh = tables['zh-TW'][key];
  if (typeof en !== 'string' || typeof zh !== 'string') continue;
  const [a, b] = [placeholders(en), placeholders(zh)];
  if (a.join(' ') !== b.join(' ')) {
    problems.push(`${key}: placeholders differ, en ${a.join(' ') || 'none'}, zh-TW ${b.join(' ') || 'none'}`);
  }
}

if (problems.length) {
  console.error(`i18n parity: ${problems.length} problem(s)\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`i18n parity: ${Object.keys(tables['en']).length} keys, both locales complete`);
