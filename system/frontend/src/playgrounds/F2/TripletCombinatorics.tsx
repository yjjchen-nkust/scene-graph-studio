import { useState } from 'react';
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame, Readout, Toggle } from '../controls';
import { candidateSpace, flag, tripletKey, type Triplet } from '../logic';
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
  // Both knobs in the query string, per spec §4.3. The predicate was `useState` until
  // 2026-09-20, which made `?F2.predicate=near` a parameter the control advertised by its id and
  // then ignored, and left a shared link opening on whatever sorts first.
  const [params, setParams] = useLabParams({
    'F2.directed': 1,
    'F2.predicate': PREDICATES[0],
  });
  const directed = flag(params['F2.directed'], true);
  // A predicate the URL invented is not in the vocabulary the candidate space was counted over,
  // so a built edge carrying it would sit outside the bound displayed beside it.
  const predicate = PREDICATES.includes(params['F2.predicate'])
    ? params['F2.predicate']
    : PREDICATES[0];

  const [subject, setSubject] = useState<number | null>(null);
  const [object, setObject] = useState<number | null>(null);
  const [built, setBuilt] = useState<Triplet[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const candidates = candidateSpace(frame.objects.length, SLICE_PREDICATE_COUNT, directed);

  // Under the current direction setting, two built edges that share a key are one edge. The
  // count shown is therefore the number of *distinguishable* edges, which is the quantity the
  // candidate space is a bound on.
  const keys = new Set(built.map((t) => tripletKey(t, directed)));
  // Every group of two or more edges sharing a key, as whole groups. Keeping only the second and
  // later occurrences would name one edge of each merged pair, and the pair is the claim: both
  // presenter notes promise the panel lists which edges became indistinguishable, and one of
  // them is not an indistinguishable pair.
  const grouped = new Map<string, Triplet[]>();
  for (const t of built) {
    const key = tripletKey(t, directed);
    grouped.set(key, [...(grouped.get(key) ?? []), t]);
  }
  const collapsed = [...grouped.values()].filter((group) => group.length > 1);

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
    if (subject === null || object === null) {
      setNotice(t('playground.need_pair'));
      return;
    }
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
        onChange={(next) => {
          // The notice describes the pair and the predicate as they were. Changing either
          // leaves it on screen beside a state it no longer describes.
          setNotice(null);
          setParams({ 'F2.predicate': next });
        }}
      />
      <button
        type="button"
        onClick={add}
        className="rounded border border-slate-400 bg-white px-3 py-1 text-[1em]"
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
        className="rounded border border-slate-300 bg-white px-3 py-1 text-[1em]"
      >
        {t('playground.reset')}
      </button>
      <Toggle
        id="F2.directed"
        label={t('playground.directed')}
        checked={directed}
        onChange={(on) => {
          setNotice(null);
          setParams({ 'F2.directed': on ? 1 : 0 });
        }}
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
                    ? 'rounded-full border border-slate-400 bg-white px-4 py-2 text-[1em]'
                    : 'rounded-full border-2 border-slate-900 bg-slate-900 px-4 py-2 text-[1em] text-white'
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
            id="F2.candidates"
            label={t('playground.candidates')}
            value={String(candidates)}
            note={`${frame.objects.length} × ${frame.objects.length - 1}${directed ? '' : ' / 2'} × ${SLICE_PREDICATE_COUNT}`}
          />
          <Readout id="F2.built" label={t('playground.built')} value={String(keys.size)} note="|E|" />
        </div>
      </div>

      {notice && (
        <p data-testid="f2-notice" className="mt-3 text-[1em] text-amber-900">
          {notice}
        </p>
      )}

      <ul className="mt-3 space-y-1 font-mono text-[1em]">
        {built.map((tri, i) => (
          <li key={`${tripletKey(tri, true)}-${i}`}>
            {nameOf(tri.subject_id)} —{tri.predicate}
            {directed ? '→ ' : '— '}
            {nameOf(tri.object_id)}
          </li>
        ))}
      </ul>

      {!directed && collapsed.length > 0 && (
        <p data-testid="f2-collapsed" className="mt-3 text-[1em] text-slate-700">
          {t('playground.collapsed')}{' '}
          {/* Two separators, because they mean different things: the edges within one merged
              group are joined by "and", and one group is divided from the next. With a single
              separator doing both jobs, two collapsed pairs render as four edges in a row and
              the pairing -- which is the entire claim this panel makes -- is not recoverable
              from what the room sees. */}
          {collapsed
            .map((group) =>
              group
                .map((tri) => `${nameOf(tri.subject_id)} ${tri.predicate} ${nameOf(tri.object_id)}`)
                .join(t('playground.and')),
            )
            .join(t('playground.group_sep'))}
        </p>
      )}
    </PlaygroundFrame>
  );
}
