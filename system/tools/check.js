const fs = require('fs');
process.chdir(__dirname);
const KM = '../web/knowledge-map/';
const src = fs.readFileSync(KM + 'pg.js', 'utf8');

const ids = [...src.matchAll(/pg\(\{id:'([^']+)'/g)].map(m => m[1]);
const grab = (name, from) => {
  const s = from || src;
  const m = s.match(new RegExp('var ' + name + '=\\{[\\s\\S]*?\\n\\};'));
  if (!m) throw new Error('cannot find ' + name);
  return new Function('return ' + m[0].replace(new RegExp('^var ' + name + '='), '').replace(/;$/, ''))();
};
const MATH = grab('MATH');
const DERIV = grab('DERIV');
const ALIAS = new Function('return ' + src.match(/var PG_ALIAS=(\{[^;]*\});/)[1])();

let problems = [];
const count = (s, needle) => s.split(needle).length - 1;

for (const [k, v] of Object.entries(DERIV)) {
  const b = count(v, '\\begin{aligned}');
  const e = count(v, '\\end{aligned}');
  if (b !== e) problems.push(`${k}: begin=${b} end=${e}`);
  const o = count(v, '\\[') - count(v, '\\\\[');   // \\[6pt] is a line break, not a display open
  const c = count(v, '\\]') - count(v, '\\\\]');
  if (o !== c) problems.push(`${k}: display \\[=${o} \\]=${c}`);
  if (count(v, '{') !== count(v, '}')) problems.push(`${k}: braces ${count(v,'{')}/${count(v,'}')}`);
}
for (const [k, v] of Object.entries(MATH)) {
  if (count(v, '{') !== count(v, '}')) problems.push(`MATH ${k}: braces`);
  const o = count(v, '\\[') - count(v, '\\\\[');
  const c = count(v, '\\]') - count(v, '\\\\]');
  if (o !== c) problems.push(`MATH ${k}: display ${o}/${c}`);
}

/* Every knowledge point tagged 'live' in kp-data.js must resolve to a playground,
   either because one is built under its own id or because PG_ALIAS sends it to the
   playground that hosts it. Without this the table of contents renders a green
   'live' tag with no link and nothing complains — a silent failure. */
const kp = fs.readFileSync(KM + 'kp-data.js', 'utf8');
const CLUSTERS = new Function('return ' + kp.match(/const CLUSTERS = (\[[\s\S]*\]);\s*$/)[1])();
const built = new Set(ids);
const liveKps = [];
CLUSTERS.forEach(c => c.kps.forEach(k => { if (k[4] === 'live') liveKps.push(k[0]); }));
const dangling = liveKps.filter(id => !built.has(id) && !ALIAS[id]);
if (dangling.length) problems.push(`live knowledge points with no playground and no alias: ${dangling.join(', ')}`);
const badAlias = Object.entries(ALIAS).filter(([, target]) => !built.has(target));
if (badAlias.length) problems.push(`PG_ALIAS points at no playground: ${badAlias.map(([a, b]) => a + '→' + b).join(', ')}`);
const staleAlias = Object.keys(ALIAS).filter(id => built.has(id));
if (staleAlias.length) problems.push(`PG_ALIAS shadows a real playground: ${staleAlias.join(', ')}`);

const totalKps = CLUSTERS.reduce((a, c) => a + c.kps.length, 0);
console.log('playgrounds:', ids.length, '| math:', Object.keys(MATH).length, '| derivations:', Object.keys(DERIV).length);
console.log('knowledge points:', totalKps, 'in', CLUSTERS.length, 'clusters |', liveKps.length, 'live,',
            `hosted by ${ids.length} playgrounds (${Object.keys(ALIAS).map(a => a + '→' + ALIAS[a]).join(', ') || 'no aliases'})`);
console.log('orphans:', Object.keys(DERIV).filter(k => !ids.includes(k)).join(',') || 'none');
console.log('no derivation:', ids.filter(i => !DERIV[i]).join(', ') || 'none');
console.log('PROBLEMS:', problems.length ? '\n  ' + problems.join('\n  ') : 'none');
process.exit(problems.length ? 1 : 0);
