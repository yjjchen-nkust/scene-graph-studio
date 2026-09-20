import { useState } from 'react';
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame, Readout, Toggle } from '../controls';
import { candidateSpace, tripletKey, type Triplet } from '../logic';
import { FRAMES, PREDICATES, SLICE_PREDICATE_COUNT } from '../slice';

/**
 * F2 — 三元組與 G=(V,E,T).
 *
 * The abstract graph, not the photograph. That is exactly where the boundary against L1 falls:
 * L1 keeps the image, the ground truth and PredCls scoring, and this keeps the combinatorics.
 * Nothing here is scored and nothing is compared against an answer.
 *
 * Not `SceneGraphView`, although it exists and draws a node-link diagram: it renders through
 * cytoscape onto a canvas, and a canvas node is not a DOM element, so it cannot be a `<button>`.
 * Spec §4.2 requires every knob to be reachable from the keyboard, and check 8 walks the whole
 * lecture without a mouse.
 *
 * The direction toggle is the substantive control. Discarding direction halves the candidate
 * space and merges any pair of edges that differed only by their order, and the panel names
 * which ones — M0's second implication, 方向承載語意，對稱化會使其消失, as a demonstration
 * rather than a sentence.
 */
export function TripletCombinatorics() {
  const { t } = useLocale();
  const frame = FRAMES[0];
  const [params, setParams] = useLabParams({ 'F2.directed': 1 });
  const directed = params['F2.directed'] === 1;

  const [subject, setSubject] = useState<number | null>(null);
  const [object, setObject] = useState<number | null>(null);
  const [predicate, setPredicate] = useState(PREDICATES[0]);
  const [built, setBuilt] = useState<Triplet[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const candidates = candidateSpace(frame.objects.length, SLICE_PREDICATE_COUNT, directed);

  // Under the current direction setting, two built edges that share a key are one edge. The
  // count shown is therefore the number of *distinguishable* edges, which is the quantity the
  // candidate space is a bound on.
  const keys = new Set(built.map((t) => tripletKey(t, directed)));
  const collapsed = built.filter(
    (t, i) => built.findIndex((u) => tripletKey(u, directed) === tripletKey(t, directed)) !== i,
  );

  function pick(objectId: number) {
    setNotice(null);
    if (subject === null) {
      setSubject(objectId);
      return;
    }
    if (objectId === subject) {
      setNotice(t('playground.self_pair'));
      return;
    }
    setObject(objectId);
  }

  function add() {
    if (subject === null || object === null) return;
    const triplet: Triplet = { subject_id: subject, predicate, object_id: object };
    if (built.some((t) => tripletKey(t, true) === tripletKey(triplet, true))) {
      setNotice(t('playground.duplicate'));
      return;
    }
    setBuilt([...built, triplet]);
    setSubject(null);
    setObject(null);
    setNotice(null);
  }

  const nameOf = (id: number) =>
    frame.objects.find((o) => o.object_id === id)?.names[0] ?? String(id);

  const controls = (
    <>
      <Choice
        id="F2.predicate"
        label={t('playground.predicate')}
        value={predicate}
        options={PREDICATES.map((p) => ({ value: p, label: p }))}
        onChange={setPredicate}
      />
      <button
        type="button"
        onClick={add}
        className="rounded border border-slate-400 bg-white px-3 py-1 text-base"
      >
        {t('playground.add_edge')}
      </button>
      <button
        type="button"
        onClick={() => {
          setBuilt([]);
          setSubject(null);
          setObject(null);
          setNotice(null);
        }}
        className="rounded border border-slate-300 bg-white px-3 py-1 text-base"
      >
        {t('playground.reset')}
      </button>
      <Toggle
        id="F2.directed"
        label={t('playground.directed')}
        checked={directed}
        onChange={(on) => setParams({ 'F2.directed': on ? 1 : 0 })}
      />
    </>
  );

  return (
    <PlaygroundFrame title="F2" controls={controls}>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex flex-1 flex-wrap gap-2">
          {frame.objects.map((o) => {
            const role =
              o.object_id === subject ? 'subject' : o.object_id === object ? 'object' : 'none';
            return (
              <button
                key={o.object_id}
                type="button"
                data-testid={`node-${o.object_id}`}
                data-role={role}
                onClick={() => pick(o.object_id)}
                className={
                  role === 'none'
                    ? 'rounded-full border border-slate-400 bg-white px-4 py-2 text-base'
                    : 'rounded-full border-2 border-slate-900 bg-slate-900 px-4 py-2 text-base text-white'
                }
              >
                {/* The role is spelled out, not only coloured: NFR-5 forbids hue as the only
                    channel, and subject against object is the distinction that matters here. */}
                {o.names[0]}
                {role !== 'none' ? ` · ${role}` : ''}
              </button>
            );
          })}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-1">
          <Readout
            label={t('playground.candidates')}
            value={String(candidates)}
            note={`${frame.objects.length} × ${frame.objects.length - 1}${directed ? '' : ' / 2'} × ${SLICE_PREDICATE_COUNT}`}
          />
          <Readout label={t('playground.built')} value={String(keys.size)} note="|E|" />
        </div>
      </div>

      {notice && (
        <p data-testid="f2-notice" className="mt-3 text-base text-amber-700">
          {notice}
        </p>
      )}

      <ul className="mt-3 space-y-1 font-mono text-base">
        {built.map((tri, i) => (
          <li key={`${tripletKey(tri, true)}-${i}`}>
            {nameOf(tri.subject_id)} —{tri.predicate}
            {directed ? '→ ' : '— '}
            {nameOf(tri.object_id)}
          </li>
        ))}
      </ul>

      {!directed && collapsed.length > 0 && (
        <p data-testid="f2-collapsed" className="mt-3 text-base text-slate-700">
          {t('playground.collapsed')}{' '}
          {collapsed
            .map((tri) => `${nameOf(tri.subject_id)} ${tri.predicate} ${nameOf(tri.object_id)}`)
            .join('、')}
        </p>
      )}
    </PlaygroundFrame>
  );
}
