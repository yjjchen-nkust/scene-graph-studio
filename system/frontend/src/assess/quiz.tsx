import { useState } from 'react';
import type { SceneGraph, SGRelationship } from 'sgg-metrics';
import { useLocale } from '../i18n/useLocale';
import { perturb, seed, type CorruptionKind } from './perturb';
import { gradeItem, RATING } from './schedule';

export interface QuizItem {
  /** `module:step:n`. Stable across runs, because it is the key the FSRS schedule stores. */
  id: string;
  graph: SceneGraph;
  corruptedIndex: number;
  kind: CorruptionKind;
  /** The relation before it was corrupted. A wrong answer has to be able to show the right one. */
  original: SGRelationship;
}

/**
 * A small integer from a string, so an item's seed is a function of where the item is.
 *
 * djb2. The requirement is only that two different step ids give two different streams — without
 * it every checkpoint in the course asks the same question — and that the same id gives the same
 * one, so a student can be shown an item again.
 */
function hash(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = (h * 33) ^ text.charCodeAt(i);
  return h >>> 0;
}

/**
 * The items for one checkpoint.
 *
 * Capped at one per relationship: a fourth item over a three-relation graph would repeat a
 * corruption the reader has just answered, and a quiz that repeats itself trains recall of the
 * item rather than of the thing.
 */
export function itemsFor(
  moduleId: string,
  stepId: string,
  gt: SceneGraph,
  count: number,
): QuizItem[] {
  const n = Math.min(count, gt.relationships.length);
  const items: QuizItem[] = [];
  for (let i = 0; i < n; i += 1) {
    const id = `${moduleId}:${stepId}:${i}`;
    const { graph, corruptedIndex, kind } = perturb(gt, seed(hash(id)));
    items.push({ id, graph, corruptedIndex, kind, original: gt.relationships[corruptedIndex]! });
  }
  return items;
}

function triplet(graph: SceneGraph, r: SGRelationship): string {
  const nameOf = (id: number) =>
    graph.objects.find((o) => o.object_id === id)?.names[0] ?? String(id);
  return `${nameOf(r.subject_id)} — ${r.predicate} → ${nameOf(r.object_id)}`;
}

/**
 * One graph with one relation made wrong, and the question "which one".
 *
 * PRD §6.5. The item is generated rather than authored, which is what makes a checkpoint exist
 * in every module without a lecturer writing ninety of them — and it is also the limit: it can
 * ask whether a reader can adjudicate a triplet against a picture of the scene, and it cannot
 * ask anything about the module's prose.
 *
 * An answer is graded once, and the options are disabled the moment one is given. That is the
 * whole mechanism — there was briefly a second guard inside the handler as well, and it was
 * removed when a mutation showed no test could reach it: the disabled attribute had already
 * stopped the click. Two mechanisms for one rule means one of them is untested.
 *
 * Re-reading a checkpoint is not a second review, and counting it as one would let a reader push
 * a card out by clicking through a page they already know.
 */
export function Quiz({ items }: { items: QuizItem[] }) {
  const { t } = useLocale();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [graded, setGraded] = useState<Record<string, boolean>>({});

  if (items.length === 0) {
    return (
      <p data-testid="quiz-empty" className="text-sm text-slate-600">
        {t('quiz.empty')}
      </p>
    );
  }

  if (index >= items.length) {
    const right = Object.values(graded).filter(Boolean).length;
    return (
      <section className="rounded border border-slate-200 p-4">
        <p data-testid="quiz-score" className="text-slate-800">
          {t('quiz.score')} {right} / {items.length}
        </p>
      </section>
    );
  }

  const item = items[index]!;
  const correct = picked === item.corruptedIndex;

  function answer(choice: number) {
    setPicked(choice);
    const right = choice === item.corruptedIndex;
    setGraded((prev) => ({ ...prev, [item.id]: right }));
    gradeItem(item.id, right ? RATING.good : RATING.again, new Date());
  }

  return (
    <section className="rounded border border-slate-200 p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h3 className="font-semibold text-slate-900">{t('quiz.heading')}</h3>
        <span data-testid="item-position" className="font-mono text-sm text-slate-500">
          {index + 1} / {items.length}
        </span>
      </header>

      <p className="mb-3 text-sm text-slate-600">{t('quiz.prompt')}</p>

      <ul className="space-y-2">
        {item.graph.relationships.map((r, i) => (
          <li key={r.relationship_id}>
            <button
              type="button"
              data-testid={`option-${i}`}
              onClick={() => answer(i)}
              disabled={picked !== null}
              className={`w-full rounded border px-3 py-2 text-left font-mono text-sm ${
                picked === i ? 'border-slate-900 bg-slate-100' : 'border-slate-300'
              }`}
            >
              {triplet(item.graph, r)}
            </button>
          </li>
        ))}
      </ul>

      {picked !== null && (
        <div
          data-testid="verdict"
          data-correct={String(correct)}
          className={`mt-4 rounded border p-3 text-sm ${
            correct ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'
          }`}
        >
          <p className="font-semibold">{correct ? t('quiz.right') : t('quiz.wrong')}</p>
          <p className="mt-1">
            {item.kind === 'reversed' ? t('quiz.why_reversed') : t('quiz.why_predicate')}
          </p>
          <p className="mt-1">
            {t('quiz.answer')}{' '}
            <span data-testid="answer" className="font-mono">
              {triplet(item.graph, item.original)}
            </span>
          </p>
          <button
            type="button"
            data-testid="next"
            onClick={() => {
              setIndex(index + 1);
              setPicked(null);
            }}
            className="mt-3 rounded border border-slate-300 px-3 py-1"
          >
            {t('quiz.next')}
          </button>
        </div>
      )}
    </section>
  );
}
