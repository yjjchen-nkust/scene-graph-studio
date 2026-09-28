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
      continue;
    }
    // Only a {\w+} name is compared below, so any other braced name would escape the comparison
    // and a translation that dropped it would pass (D104).
    for (const [token] of value.matchAll(/\{[^{}]*\}/g)) {
      if (!/^\{\w+\}$/.test(token)) {
        problems.push(`${key}: ${token} in ${locale} is not a placeholder name`);
      }
    }
    // A brace left once the innermost pairs are gone encloses none, as in {{n}} or a lone {.
    if (/[{}]/.test(value.replace(/\{[^{}]*\}/g, ''))) {
      problems.push(`${key}: a brace outside a placeholder in ${locale}`);
    }
  }
}

// A placeholder is filled by String.replace, which fills its first occurrence only, so each locale
// must carry the same ones, each the same number of times, and no value may repeat one; a
// translation that drops or repeats one prints wrong in that locale only.
const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => `{${m[1]}}`).sort();
let placeheld = 0;
for (const [key, en] of Object.entries(tables['en'])) {
  const zh = tables['zh-TW'][key];
  if (typeof en !== 'string' || typeof zh !== 'string') continue;
  const [a, b] = [placeholders(en), placeholders(zh)];
  if (a.length || b.length) placeheld += 1;
  if (a.join(' ') !== b.join(' ')) {
    problems.push(`${key}: placeholders differ, en ${a.join(' ') || 'none'}, zh-TW ${b.join(' ') || 'none'}`);
  }
  for (const [locale, list] of [['en', a], ['zh-TW', b]]) {
    for (const p of new Set(list.filter((p, i) => list.indexOf(p) !== i))) {
      problems.push(`${key}: ${p} occurs more than once in ${locale}`);
    }
  }
}

if (problems.length) {
  console.error(`i18n parity: ${problems.length} problem(s)\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(
  `i18n parity: ${Object.keys(tables['en']).length} keys, both locales complete; ` +
  `${placeheld} carry a placeholder, all agreeing`,
);
