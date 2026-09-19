import { useMemo, useState } from 'react';
import type { SceneGraph } from 'sgg-metrics';
import { ImageOverlay } from '../../graph/ImageOverlay';
import { useLocale } from '../../i18n/useLocale';
import { applyEdit, blank, tally } from './corrections';

/** The authors' set, from §4.1. The projection is against this and says so. */
const ISG_IMAGES = 10_000;

function triplets(graph: SceneGraph) {
  const name = new Map(graph.objects.map((o) => [o.object_id, o.names[0]]));
  return graph.relationships.map((r) => ({
    id: r.relationship_id,
    subject: name.get(r.subject_id) ?? String(r.subject_id),
    predicate: r.predicate,
    object: name.get(r.object_id) ?? String(r.object_id),
  }));
}

/**
 * L8 — the mini-ISG annotator, and the number that is the lesson.
 *
 * A VLM draft sits beside the frame it was drafted from, and every correction is counted:
 * deletions, additions, predicate rewrites, box adjustments. PRD §6.2 names this as the only
 * place in the application where a student sees what annotation costs, and the count is the
 * paper's own motivation reproduced at 0.4% scale — the reason a 10,000-image set is drafted by
 * a model and corrected by hand rather than annotated from nothing.
 *
 * Three things the page refuses to do:
 *
 * * **It does not call the reference set ground truth.** `data/slices/mini-isg/annotations.json`
 *   is one annotator's reading of forty frames, made in one session, and its own provenance note
 *   says so. Presenting it as the answer would teach a student to distrust their own eyes in the
 *   one exercise whose whole purpose is to train them.
 * * **It does not edit the draft.** The "before" is half of what is on screen; the working copy
 *   is separate, so a deletion removes a triplet from the student's graph and not from the
 *   drafted one they are comparing against.
 * * **It does not present the projection as a measurement.** Forty frames times two hundred and
 *   fifty is arithmetic, stated as arithmetic, beside a count that is real.
 */
export function MiniISGAnnotator({
  draft,
  reference,
  imageUrl,
  predicates,
}: {
  draft: SceneGraph;
  reference: SceneGraph | null;
  imageUrl: string;
  predicates: readonly string[];
}) {
  const { t } = useLocale();
  const [state, setState] = useState(() => blank(draft));
  const [pending, setPending] = useState({ subject: '', predicate: '', object: '' });
  // Which box a drag replaces. Nothing is guessed from where the drag started: a bench frame
  // has overlapping boxes, so "the object under the pointer" is ambiguous exactly where the
  // annotator is most likely to be working.
  const [adjusting, setAdjusting] = useState('');

  const counts = tally(state);
  const rows = triplets(state.graph);
  const draftRows = useMemo(() => triplets(draft), [draft]);
  const referenceRows = useMemo(() => (reference ? triplets(reference) : []), [reference]);

  // A draft predicate outside P must still appear in its own select, or the page would rewrite
  // the triplet to something else the moment it rendered and count nothing for it.
  const options = useMemo(() => {
    const extra = state.graph.relationships
      .map((r) => r.predicate)
      .filter((p) => !predicates.includes(p));
    return [...predicates, ...new Set(extra)];
  }, [predicates, state.graph.relationships]);

  const dictionary = useMemo(() => new Set(predicates), [predicates]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">{t('l8.heading')}</h1>
        <p className="text-sm text-slate-600">{t('l8.subheading')}</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <ImageOverlay
            imageUrl={imageUrl}
            width={draft.width}
            height={draft.height}
            objects={state.graph.objects}
            relationships={state.graph.relationships}
            mode={adjusting ? 'draw' : 'view'}
            onBoxDrawn={(bbox) => {
              setState((st) => applyEdit(st, { kind: 'box', objectId: Number(adjusting), bbox }));
              // Cleared after one adjustment, so a second drag cannot silently move the same box
              // again while the annotator believes they are drawing somewhere else.
              setAdjusting('');
            }}
            className="rounded border border-slate-200"
          />
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-700">{t('l8.adjust')}</span>
            <select
              data-testid="adjust-object"
              className="rounded border border-slate-300 px-1 py-0.5 font-mono text-sm"
              value={adjusting}
              onChange={(e) => setAdjusting(e.target.value)}
            >
              <option value="">—</option>
              {state.graph.objects.map((o) => (
                <option key={o.object_id} value={String(o.object_id)}>
                  {o.names[0]}
                </option>
              ))}
            </select>
            {adjusting && <span className="text-xs text-slate-600">{t('l8.adjust_hint')}</span>}
          </label>
        </div>

        <div className="space-y-3">
          <div
            data-testid="correction-count"
            className="rounded border border-slate-300 bg-slate-50 p-3"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('l8.count')}</p>
            <p className="text-3xl font-semibold text-slate-900">{counts.total}</p>
            <dl className="mt-2 grid grid-cols-4 gap-2 text-xs text-slate-700">
              <div>
                <dt>{t('l8.deletions')}</dt>
                <dd data-testid="count-deletions" className="font-semibold">{counts.deletions}</dd>
              </div>
              <div>
                <dt>{t('l8.additions')}</dt>
                <dd data-testid="count-additions" className="font-semibold">{counts.additions}</dd>
              </div>
              <div>
                <dt>{t('l8.predicates')}</dt>
                <dd data-testid="count-predicates" className="font-semibold">
                  {counts.predicates}
                </dd>
              </div>
              <div>
                <dt>{t('l8.boxes')}</dt>
                <dd data-testid="count-boxes" className="font-semibold">{counts.boxes}</dd>
              </div>
            </dl>
          </div>

          {counts.total > 0 && (
            <p data-testid="projection" className="rounded border border-slate-200 p-3 text-xs
              text-slate-600">
              {t('l8.projection')
                .replace('{n}', String(counts.total))
                .replace('{total}', (counts.total * ISG_IMAGES).toLocaleString('en-US'))
                .replace('{images}', ISG_IMAGES.toLocaleString('en-US'))}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-700">{t('l8.working_copy')}</h2>
        <ul className="space-y-1">
          {rows.map((row) => (
            <li
              key={row.id}
              data-testid={`triplet-${row.id}`}
              className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2
                text-sm"
            >
              <span className="font-mono text-slate-800">{row.subject}</span>
              <select
                className="rounded border border-slate-300 px-1 py-0.5 font-mono text-sm"
                aria-label={t('l8.predicate_of').replace('{s}', row.subject).replace('{o}', row.object)}
                value={row.predicate}
                onChange={(e) =>
                  setState((s) =>
                    applyEdit(s, {
                      kind: 'predicate',
                      relationshipId: row.id,
                      predicate: e.target.value,
                    }),
                  )
                }
              >
                {options.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <span className="font-mono text-slate-800">{row.object}</span>
              {!dictionary.has(row.predicate) && (
                <span
                  data-testid="oov"
                  className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900"
                >
                  {t('l8.oov')}
                </span>
              )}
              <button
                type="button"
                data-testid="delete"
                className="ml-auto rounded border border-slate-300 px-2 py-0.5 text-xs
                  text-slate-700"
                onClick={() =>
                  setState((s) => applyEdit(s, { kind: 'delete', relationshipId: row.id }))
                }
              >
                {t('l8.delete')}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2 rounded border border-dashed
          border-slate-300 p-2 text-sm">
          <select
            data-testid="add-subject"
            aria-label={t('l8.add_subject')}
            className="rounded border border-slate-300 px-1 py-0.5 font-mono text-sm"
            value={pending.subject}
            onChange={(e) => setPending((p) => ({ ...p, subject: e.target.value }))}
          >
            <option value="">—</option>
            {state.graph.objects.map((o) => (
              <option key={o.object_id} value={String(o.object_id)}>
                {o.names[0]}
              </option>
            ))}
          </select>
          <select
            data-testid="add-predicate"
            aria-label={t('l8.add_predicate')}
            className="rounded border border-slate-300 px-1 py-0.5 font-mono text-sm"
            value={pending.predicate}
            onChange={(e) => setPending((p) => ({ ...p, predicate: e.target.value }))}
          >
            <option value="">—</option>
            {predicates.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            data-testid="add-object"
            aria-label={t('l8.add_object')}
            className="rounded border border-slate-300 px-1 py-0.5 font-mono text-sm"
            value={pending.object}
            onChange={(e) => setPending((p) => ({ ...p, object: e.target.value }))}
          >
            <option value="">—</option>
            {state.graph.objects.map((o) => (
              <option key={o.object_id} value={String(o.object_id)}>
                {o.names[0]}
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="add-triplet"
            className="rounded border border-slate-400 px-2 py-0.5 text-xs text-slate-800"
            disabled={!pending.subject || !pending.predicate || !pending.object}
            onClick={() => {
              setState((s) =>
                applyEdit(s, {
                  kind: 'add',
                  subjectId: Number(pending.subject),
                  predicate: pending.predicate,
                  objectId: Number(pending.object),
                }),
              );
              setPending({ subject: '', predicate: '', object: '' });
            }}
          >
            {t('l8.add')}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 text-sm">
        <div data-testid="draft-panel" className="rounded border border-slate-200 p-3">
          <h2 className="mb-1 text-xs uppercase tracking-wide text-slate-500">{t('l8.draft')}</h2>
          <p className="mb-2 text-xs text-slate-600">{t('l8.draft_note')}</p>
          <ul className="space-y-0.5 font-mono text-xs text-slate-700">
            {draftRows.map((row) => (
              <li key={row.id}>{`<${row.subject}, ${row.predicate}, ${row.object}>`}</li>
            ))}
          </ul>
        </div>

        {reference && (
          <div data-testid="reference-panel" className="rounded border border-slate-200 p-3">
            <h2 className="mb-1 text-xs uppercase tracking-wide text-slate-500">
              {t('l8.reference')}
            </h2>
            <p className="mb-2 text-xs text-slate-600">{t('l8.reference_note')}</p>
            <ul className="space-y-0.5 font-mono text-xs text-slate-700">
              {referenceRows.map((row) => (
                <li key={row.id}>{`<${row.subject}, ${row.predicate}, ${row.object}>`}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
