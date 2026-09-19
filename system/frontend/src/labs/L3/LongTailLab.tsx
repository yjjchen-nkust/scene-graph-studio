import { useMemo } from 'react';
import type { SceneGraph, SGObject } from 'sgg-metrics';
import { evaluate } from 'sgg-metrics';
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../useLabParams';
import { covarianceGap, fitFreq, predictFreq, zipfCorpus, type VisualScorer } from './freq';

const CLASSES = ['person', 'table', 'cup', 'shelf', 'box'];
const PREDICATES = ['on', 'near', 'holding', 'under'];
// K = 20 of 80 candidates. At K = 5 the cutoff falls inside the block of ties that a flat
// conditional produces, so the same single relation is recovered at every exponent and the
// Zipf slider moves the distribution without moving the metric. The control has to reach past
// the ties to show what it is for.
const K = 20;

const OBJECTS: SGObject[] = CLASSES.map((name, i) => ({
  object_id: i + 1,
  names: [name],
  bbox: { x: i * 10, y: i * 10, w: 8, h: 8 },
}));

/** Three head relations and two tail relations, the tail on pairs the corpus rarely shows. */
const GT: SceneGraph = {
  image_id: 'l3',
  dataset: 'placeholder',
  width: 100,
  height: 100,
  objects: OBJECTS,
  relationships: [
    { relationship_id: 1, subject_id: 3, object_id: 2, predicate: 'on', score: null },
    { relationship_id: 2, subject_id: 1, object_id: 2, predicate: 'on', score: null },
    { relationship_id: 3, subject_id: 4, object_id: 2, predicate: 'on', score: null },
    { relationship_id: 4, subject_id: 1, object_id: 5, predicate: 'holding', score: null },
    { relationship_id: 5, subject_id: 5, object_id: 4, predicate: 'under', score: null },
  ],
  provenance: { kind: 'ground_truth', fidelity: 'measured' },
} as SceneGraph;

/** The stand-in for `f_theta(V, s, o)`: it reads the frame, gets the tail right, misses the head. */
const VISUAL: VisualScorer = (s, o, predicate) => {
  const triple = `${s}|${o}|${predicate}`;
  if (triple === 'person|box|holding') return 1.0;
  if (triple === 'box|shelf|under') return 0.95;
  return ({ under: 0.3, holding: 0.3, near: 0.2, on: 0.01 })[predicate] ?? 0.1;
};

function scoreAt(zipf: number, lambda: number) {
  const model = fitFreq(zipfCorpus(zipf, PREDICATES, CLASSES));
  const pred = {
    ...GT,
    relationships: predictFreq(model, OBJECTS, lambda, VISUAL),
    provenance: { kind: 'model', fidelity: 'reconstructed', note: 'the lab computes this live' },
  } as SceneGraph;
  const body = evaluate({
    gt: GT,
    pred,
    protocol: 'predcls',
    constraint: 'none',
    k: [K],
    iou_thresh: 0.5,
    mask_pairing: 'single_mpo',
  });
  const value = (metric: string) =>
    (body.metrics.find((m) => m.metric === metric && m.k === K)?.value ?? 0) * 100;
  return { r: value('R'), mr: value('mR'), gap: covarianceGap(body.per_predicate, K) * 100 };
}

/** `R@k - mR@k` at one point of the two-dimensional control surface. Exported for the test. */
export function gapAt(zipf: number, lambda: number): number {
  return scoreAt(zipf, lambda).gap;
}

/**
 * L3 — the frequency baseline that humiliated the field, run live in the browser.
 *
 * Two controls, and between them they carry the whole argument. `lambda` is E11's blend: at zero
 * nothing in `predictFreq` can reach an image, and the prior still posts a competitive `R`. The
 * Zipf exponent is what makes that general rather than a fact about Visual Genome — flatten the
 * predicate distribution and the advantage evaporates, because there was never anything to
 * exploit but the skew.
 *
 * The number between the two panels is E6's identity, `R@k - mR@k = Cov(n, R) / n-bar`, evaluated
 * rather than quoted. The whole bias problem is the sign of that one covariance, so it is one
 * number on the page and not a paragraph.
 */
export function LongTailLab() {
  const { t } = useLocale();
  const [params, setParams] = useLabParams({ lambda: 0, zipf: 1.5 });
  const lambda = Math.min(1, Math.max(0, params.lambda));
  const zipf = Math.min(3, Math.max(0, params.zipf));

  const freq = useMemo(() => scoreAt(zipf, 0), [zipf]);
  const visual = useMemo(() => scoreAt(zipf, 1), [zipf]);
  const blended = useMemo(() => scoreAt(zipf, lambda), [zipf, lambda]);

  const panel = (
    id: string,
    heading: string,
    figures: { r: number; mr: number },
    caption: string,
  ) => (
    <article data-testid={`panel-${id}`} className="space-y-2 rounded border border-slate-300 p-4">
      <h2 className="text-base font-semibold text-slate-900">{heading}</h2>
      <dl className="flex gap-6">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">R@{K}</dt>
          <dd data-testid="R" className="font-mono text-2xl">{figures.r.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">mR@{K}</dt>
          <dd data-testid="mR" className="font-mono text-2xl">{figures.mr.toFixed(1)}</dd>
        </div>
      </dl>
      <p className="text-xs text-slate-600">{caption}</p>
    </article>
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">{t('l3.heading')}</h1>
        <p className="text-sm text-slate-600">{t('l3.subheading')}</p>
      </header>

      <section className="flex flex-wrap gap-8 text-sm">
        <label className="space-y-1">
          <span className="block text-slate-700">
            {t('l3.lambda')}: <span className="font-mono">{lambda.toFixed(2)}</span>
          </span>
          <input
            data-testid="lambda"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={lambda}
            onChange={(e) => setParams({ lambda: Number(e.target.value) })}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-slate-700">
            {t('l3.zipf')}: <span className="font-mono">{zipf.toFixed(1)}</span>
          </span>
          <input
            data-testid="zipf"
            type="range"
            min={0}
            max={3}
            step={0.1}
            value={zipf}
            onChange={(e) => setParams({ zipf: Number(e.target.value) })}
          />
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {panel('freq', t('l3.freq_heading'), freq, t('l3.freq_caption'))}
        {panel('visual', t('l3.visual_heading'), visual, t('l3.visual_caption'))}
      </section>

      <section className="rounded border-l-4 border-slate-400 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold text-slate-800">{t('l3.identity')}</h2>
        <p className="font-mono text-sm text-slate-700">
          R@{K} − mR@{K} = Cov(n, R) / n̄ ={' '}
          <span data-testid="gap" className="text-lg">{freq.gap.toFixed(1)}</span>
        </p>
        <p className="mt-1 text-xs text-slate-600">{t('l3.identity_note')}</p>
      </section>

      <section data-testid="blended" className="text-sm text-slate-700">
        {t('l3.blended')}: R@{K} <span className="font-mono">{blended.r.toFixed(1)}</span> · mR@{K}{' '}
        <span className="font-mono">{blended.mr.toFixed(1)}</span>
      </section>
    </div>
  );
}
