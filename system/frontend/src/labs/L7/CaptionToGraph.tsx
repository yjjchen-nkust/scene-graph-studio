import { useMemo } from 'react';
import { VERDICT_STYLE } from '../../graph/palette';
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../useLabParams';
import { O_DEFAULT, outOfVocabulary, P_DEFAULT, parse, type CaptionWarning } from './parse';

const WARNING_KEY: Record<CaptionWarning, string> = {
  no_predicate: 'l7.warn_no_predicate',
  self_loop: 'l7.warn_self_loop',
  unparsed_word: 'l7.warn_unparsed',
};

/**
 * L7 — a sentence becomes a graph as it is typed.
 *
 * The lab's argument is that a caption and a scene graph carry the same structure: nouns are
 * nodes, and what sits between two nouns is an edge. Watching the graph grow word by word is the
 * cheapest way to make that correspondence obvious, which is why nothing here is behind a button.
 *
 * The one place it is not merely illustrative is the out-of-vocabulary predicate. It renders in
 * the shared `spurious` style — from `VERDICT_STYLE`, never a colour of its own — and the cost is
 * stated in words beside it: knowledge point L10, one error counted twice, because the illegal
 * triplet occupies a rank a legal one could have held *and* leaves the true relation unmatched.
 */
export function CaptionToGraph() {
  const { t } = useLocale();
  const [params, setParams] = useLabParams({ s: '' as string });
  const sentence = params.s;

  const graph = useMemo(() => parse(sentence), [sentence]);
  const oov = useMemo(() => new Set(outOfVocabulary(graph, P_DEFAULT)), [graph]);
  const nameOf = useMemo(
    () => new Map(graph.objects.map((o) => [o.object_id, o.names[0]])),
    [graph],
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">{t('l7.heading')}</h1>
        <p className="text-sm text-slate-600">{t('l7.subheading')}</p>
      </header>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">{t('l7.caption')}</span>
        <input
          data-testid="caption"
          className="w-full rounded border border-slate-300 p-2 text-lg"
          value={sentence}
          placeholder={t('l7.placeholder')}
          onChange={(e) => setParams({ s: e.target.value })}
        />
      </label>

      <section className="grid gap-4 md:grid-cols-2 text-sm">
        <div data-testid="vocab-O" className="rounded border border-slate-200 p-3">
          <h2 className="mb-1 text-xs uppercase tracking-wide text-slate-500">{t('l7.vocab_o')}</h2>
          <p className="font-mono text-xs text-slate-700">{O_DEFAULT.join(' · ')}</p>
        </div>
        <div data-testid="vocab-P" className="rounded border border-slate-200 p-3">
          <h2 className="mb-1 text-xs uppercase tracking-wide text-slate-500">{t('l7.vocab_p')}</h2>
          <p className="font-mono text-xs text-slate-700">{P_DEFAULT.join(' · ')}</p>
        </div>
      </section>

      {graph.objects.length === 0 ? (
        <p data-testid="idle" className="rounded border border-slate-200 bg-slate-50 p-4 text-sm
          text-slate-600">
          {t('l7.idle')}
        </p>
      ) : (
        <section className="space-y-4">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">{t('l7.nodes')}</h2>
            <ul className="flex flex-wrap gap-2">
              {graph.objects.map((o) => (
                <li
                  key={o.object_id}
                  data-testid={`node-${o.object_id}`}
                  className="rounded-full border border-slate-400 bg-white px-3 py-1 font-mono text-sm"
                >
                  {o.names[0]}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">{t('l7.edges')}</h2>
            <ul className="space-y-1">
              {graph.relationships.map((r) => {
                const illegal = oov.has(r.predicate);
                const stroke = illegal ? VERDICT_STYLE.spurious.stroke : '#334155';
                return (
                  <li
                    key={r.relationship_id}
                    data-testid={`edge-${r.relationship_id}`}
                    data-oov={String(illegal)}
                    data-stroke={stroke}
                    className="font-mono text-sm"
                    style={{
                      color: stroke,
                      fontWeight: illegal ? 700 : 400,
                      textDecoration: illegal ? 'underline wavy' : 'none',
                    }}
                  >
                    &lt;{nameOf.get(r.subject_id)}, {r.predicate}, {nameOf.get(r.object_id)}&gt;
                  </li>
                );
              })}
            </ul>
          </div>

          {oov.size > 0 ? (
            <p
              data-testid="oov-cost"
              className="rounded border-l-4 p-3 text-sm"
              style={{
                borderColor: VERDICT_STYLE.spurious.stroke,
                backgroundColor: '#fef3f2',
                color: '#7a271a',
              }}
            >
              <span className="font-mono">{[...oov].join(', ')}</span> — {t('l7.oov_cost')}
            </p>
          ) : null}

          {graph.warnings.length > 0 ? (
            <ul data-testid="warnings" className="space-y-1 text-xs text-amber-900">
              {graph.warnings.map((w) => (
                <li key={w} className="rounded bg-amber-50 p-2">
                  {t(WARNING_KEY[w])}
                </li>
              ))}
            </ul>
          ) : null}

          <p data-testid="geometry-note" className="text-xs text-slate-600">
            {graph.provenance.note}
          </p>
        </section>
      )}
    </div>
  );
}
