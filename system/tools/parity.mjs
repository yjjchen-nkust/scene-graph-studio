// NFR-3: the Python and TypeScript engines must agree on every golden vector.
// The Python side is authoritative. This harness is the mechanism, and `npm run ci` runs it.
//
// It imports the COMPILED engine (packages/sgg-metrics/dist), not the .ts source, because
// source import would pin the harness to Node's type stripping (>= 22.6). See DEVIATIONS.md D2.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { pythonPath } from './py.mjs';

const TOL = 1e-9;
const DIST = new URL('../packages/sgg-metrics/dist/index.js', import.meta.url);

if (!existsSync(DIST)) {
  console.error('parity: dist not built. Run `npm run build:metrics` first.');
  process.exit(1);
}
const { evaluate } = await import(DIST.href);

const cases = JSON.parse(readFileSync('../data/golden/vectors.json', 'utf-8')).cases;
// The authoritative side has to run on the project's interpreter (py12), not on whatever the
// shell's PATH resolves: a parity claim is about one pair of engines, and naming neither of them
// would leave the pair undefined.
const python = JSON.parse(
  execFileSync(pythonPath(), ['backend/scripts/run_golden.py'], { encoding: 'utf-8' }),
);

const failures = [];
for (const c of cases) {
  const body = evaluate({ gt: c.gt, pred: c.pred, ...c.params });
  const ts = {
    metrics: Object.fromEntries(body.metrics.map((m) => [`${m.metric}@${m.k}`, m.value])),
    verdicts: body.verdicts.map((v) => [v.pred_index, v.verdict, v.gt_index]),
    warnings: body.warnings.map((w) => w.code).sort(),
    matched_count: body.matched_count,
    gt_count: body.gt_count,
    pred_count_considered: body.pred_count_considered,
  };
  const py = python[c.id];
  if (!py) { failures.push(`${c.id}: missing from the python run`); continue; }

  for (const [key, want] of Object.entries(py.metrics)) {
    const have = ts.metrics[key];
    const agree = want === null ? have === null : Math.abs(have - want) < TOL;
    if (!agree) failures.push(`${c.id} ${key}: python=${want} typescript=${have}`);
  }
  if (JSON.stringify(py.verdicts) !== JSON.stringify(ts.verdicts)) {
    failures.push(
      `${c.id} verdicts differ\n    python     = ${JSON.stringify(py.verdicts)}\n` +
      `    typescript = ${JSON.stringify(ts.verdicts)}`,
    );
  }
  if (JSON.stringify(py.warnings) !== JSON.stringify(ts.warnings)) {
    failures.push(`${c.id} warnings differ: ${py.warnings} vs ${ts.warnings}`);
  }
  for (const field of ['matched_count', 'gt_count', 'pred_count_considered']) {
    if (py[field] !== ts[field]) {
      failures.push(`${c.id} ${field}: python=${py[field]} typescript=${ts[field]}`);
    }
  }
}

if (failures.length) {
  console.error(`parity: ${failures.length} disagreement(s)\n  ` + failures.join('\n  '));
  process.exit(1);
}
console.log(`parity: ${cases.length} cases agree`);
