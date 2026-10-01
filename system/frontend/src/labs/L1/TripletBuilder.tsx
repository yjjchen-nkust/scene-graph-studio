import { useMemo, useRef } from 'react';
import type { SceneGraph } from 'sgg-metrics';
import { evaluate } from 'sgg-metrics';
import { MetricReadout } from '../../components/MetricReadout';
import { WarningList } from '../../components/WarningList';
import { ExportButtons } from '../../export/ExportButtons';
import { DiffLegend } from '../../graph/DiffLegend';
import { ImageOverlay } from '../../graph/ImageOverlay';
import { SceneGraphView } from '../../graph/SceneGraphView';
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../useLabParams';
import type { Triplet } from './triplets';
import {
  DEFAULT_PARAMS,
  RECALL_K,
  TRIPLET_PARAMS,
  decodeTriplets,
  encodeTriplets,
  studentGraph,
} from './triplets';

export interface TripletBuilderProps {
  gt: SceneGraph;
  imageUrl: string;
  /** Defaults to the predicates this scene actually contains, which is what the slice can teach. */
  predicates?: string[];
}

/**
 * L1 — ground two objects, name the relation between them, submit, read the diff.
 *
 * Scoring runs in the browser through `sgg-metrics` rather than `/api/eval`. The two engines are
 * held identical by plan 01's parity harness, so this is a latency decision and not a semantic
 * one: NFR-8 allows 100 ms for a lab interaction and a round trip does not fit reliably.
 *
 * Every piece of shareable state is a search parameter (contracts §2.2). The lab keeps no local
 * copy, so a submitted diff is a link, and the professor's projected configuration is the one a
 * student gets by pasting it.
 *
 * The export is rendered here rather than by the mount, because the graph it writes is the
 * student's (PRD §6.6, "any constructed graph"), and that graph exists only here. The mount holds
 * only the annotation, and an export handed that wrote the answer key where the student's graph
 * belonged.
 */
export function TripletBuilder({ gt, imageUrl, predicates }: TripletBuilderProps) {
  const { t } = useLocale();
  const [params, setParams] = useLabParams(TRIPLET_PARAMS);
  const overlayArea = useRef<HTMLElement>(null);

  const subject = params.s === null ? undefined : Number(params.s);
  const object = params.o === null ? undefined : Number(params.o);
  const predicate = params.p ?? '';
  const triplets = useMemo(() => decodeTriplets(params.t), [params.t]);
  const submitted = params.sub === 1 && triplets.length > 0;

  const choices = useMemo(() => {
    if (predicates) return predicates;
    return [...new Set(gt.relationships.map((r) => r.predicate))].sort();
  }, [gt, predicates]);

  const pending: Triplet | null =
    subject !== undefined && object !== undefined && predicate
      ? { subject_id: subject, object_id: object, predicate }
      : null;

  const pred = useMemo(() => studentGraph(gt, triplets), [gt, triplets]);
  const result = useMemo(
    () => (submitted ? evaluate({ gt, pred, ...DEFAULT_PARAMS }) : null),
    [gt, pred, submitted],
  );

  const select = (objectId: number) => {
    // First click names the subject, second the object, third starts over. Clicking the subject
    // again clears it rather than silently making it the object of itself.
    if (subject === undefined) setParams({ s: String(objectId), sub: 0 });
    else if (objectId === subject) setParams({ s: null, o: null, sub: 0 });
    else setParams({ o: String(objectId), sub: 0 });
  };

  const commit = (): Triplet[] => {
    if (!pending) return triplets;
    const already = triplets.some(
      (x) =>
        x.subject_id === pending.subject_id &&
        x.object_id === pending.object_id &&
        x.predicate === pending.predicate,
    );
    return already ? triplets : [...triplets, pending];
  };

  const add = () => {
    setParams({ t: encodeTriplets(commit()), s: null, o: null, p: null, sub: 0 });
  };

  const submit = () => {
    setParams({ t: encodeTriplets(commit()), s: null, o: null, p: null, sub: 1 });
  };

  const recall = result?.metrics.find((m) => m.metric === 'R' && m.k === RECALL_K) ?? null;
  const dropped = triplets.length - pred.relationships.length;

  return (
    <>
      {/* `pred`, not `gt`: the student's triplets over the frame's boxes, under `kind: 'user'`.
          It is exported whether or not it has been submitted, because it is the graph built. */}
      <ExportButtons graph={pred} targetRef={overlayArea} imageUrl={imageUrl} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section ref={overlayArea}>
          <ImageOverlay
            imageUrl={imageUrl}
            width={gt.width}
            height={gt.height}
            objects={gt.objects}
            relationships={pred.relationships}
            verdicts={result?.verdicts}
            mode="view"
            selection={{ subject, object }}
            onSelect={select}
            className="rounded border border-slate-300 bg-slate-900"
          />
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600">{t('l1.predicate')}</span>
              <select
                data-testid="predicate"
                value={predicate}
                onChange={(e) => setParams({ p: e.target.value, sub: 0 })}
                className="min-w-40 rounded border border-slate-300 px-2 py-1"
              >
                <option value="">{t('l1.predicate.choose')}</option>
                {choices.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              data-testid="add"
              onClick={add}
              disabled={pending === null}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              {t('l1.add')}
            </button>
            <button
              type="button"
              data-testid="submit"
              onClick={submit}
              disabled={pending === null && triplets.length === 0}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              {t('l1.submit')}
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {/* What will be scored, not what the address bar says: a hand-edited `t` can name an
                object the image does not contain, and such a triplet is dropped. Counting it here
                would promise the student a submission the engine never sees. */}
            {t('l1.built')}: <span data-testid="built-count">{pred.relationships.length}</span>
            {dropped > 0 ? (
              <span data-testid="dropped-count" className="ml-2 text-amber-700">
                {t('l1.dropped')}: {dropped}
              </span>
            ) : null}
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <div className="h-72 rounded border border-slate-300">
            <SceneGraphView
              graph={pred}
              gt={submitted ? gt : undefined}
              verdicts={result?.verdicts}
              layout="dagre"
            />
          </div>
          {result ? (
            <>
              <DiffLegend />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <dt className="text-slate-600">{t('l1.matched')}</dt>
                <dd data-testid="matched-count" className="font-mono">
                  {result.matched_count}
                </dd>
                <dt className="text-slate-600">{t('l1.gt_count')}</dt>
                <dd data-testid="gt-count" className="font-mono">
                  {result.gt_count}
                </dd>
              </dl>
              {recall ? (
                <div data-testid="recall">
                  <MetricReadout value={recall} />
                </div>
              ) : null}
              {/* Contracts §2.5: `gt_boxes_not_pairs` is unconditional on PredCls precisely so a
                  student cannot see the number without it. Computing it and not showing it would
                  undo the reason it is unconditional. */}
              <WarningList warnings={result.warnings} />
            </>
          ) : (
            <p className="text-sm text-slate-600">{t('l1.not_submitted')}</p>
          )}
        </section>
      </div>
    </>
  );
}
