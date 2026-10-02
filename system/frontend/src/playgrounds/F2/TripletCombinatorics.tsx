import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame, Readout, Toggle } from '../controls';
import { candidateSpace, flag, tripletKey, type Triplet } from '../logic';
import { FRAMES, PREDICATES, SLICE_PREDICATE_COUNT } from '../slice';
import { drawnEdges, edgePath, nodePlace, type Box } from './drawing';

/** slate-700 for a built edge, slate-500 dashed for the pair chosen and not yet added (NFR-5: shape as well as hue). */
const INK = '#334155';
const PENDING = '#64748b';
/** Pixels kept between a node and the edge of the drawing. */
const MARGIN = 2;

interface Layout {
  w: number;
  h: number;
  boxes: Record<number, Box>;
}

const sameLayout = (a: Layout | null, b: Layout) =>
  a !== null && a.w === b.w && a.h === b.h &&
  Object.entries(b.boxes).every(([id, box]) => {
    const was = a.boxes[Number(id)];
    return was !== undefined && was.x === box.x && was.y === box.y && was.hw === box.hw && was.hh === box.hh;
  });

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
 * So the nodes stay buttons, set round an ellipse, and the edges are drawn beneath them in one
 * `<svg>`: one curve per edge |E| counts, so the drawing and the readout cannot disagree, with
 * arrowheads while direction is kept and none once it is discarded, when two opposite arrows
 * become the one line the merge leaves (2026-10-02, D123; until then the edges were only the list
 * beneath six buttons). The drawing carries no text: a label scaled by a viewBox falls below the
 * 18 px floor (D98), so the predicates stay in the list, which is also what a screen reader reads,
 * and the drawing is hidden from it.
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

  const arrow = `${useId()}-arrow`;
  const area = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [, setResized] = useState(0);

  // Measured after every render and before paint, because a node's width changes with the role
  // it names (`table · subject`) and with the font, and an edge must reach the node's outline.
  // Each node keeps its outer side at the drawing's edge: a pill that widens grows inward. State
  // is set only when something moved, so the render this causes measures the same and stops.
  useLayoutEffect(() => {
    const box = area.current;
    if (!box || box.clientWidth === 0 || box.clientHeight === 0) return;
    const w = box.clientWidth;
    const h = box.clientHeight;
    const nodes = [...box.querySelectorAll<HTMLElement>('[data-node]')];
    const boxes: Record<number, Box> = {};
    nodes.forEach((node, i) => {
      const hw = node.offsetWidth / 2;
      const hh = node.offsetHeight / 2;
      const angle = Math.PI + (2 * Math.PI * i) / nodes.length;
      boxes[Number(node.dataset.node)] = {
        x: w / 2 + (w / 2 - hw - MARGIN) * Math.cos(angle),
        y: h / 2 + (h / 2 - hh - MARGIN) * Math.sin(angle),
        hw,
        hh,
      };
    });
    const next = { w, h, boxes };
    setLayout((prev) => (sameLayout(prev, next) ? prev : next));
  });

  // A resize of the panel or of a node (a webfont arriving) is not a render, so it asks for one.
  useLayoutEffect(() => {
    const box = area.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setResized((n) => n + 1));
    observer.observe(box);
    for (const node of box.querySelectorAll('[data-node]')) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Before the first measurement, and in jsdom, where nothing is laid out: the ellipse in
  // percentages, so the drawing still holds one curve per edge.
  const boxOf = (id: number): Box => {
    const measured = layout?.boxes[id];
    if (measured) return measured;
    const place = nodePlace(frame.objects.findIndex((o) => o.object_id === id), frame.objects.length);
    return { x: place.left, y: place.top, hw: 6, hh: 4 };
  };
  const edges = drawnEdges(built, directed);
  const pending = subject !== null && object !== null ? edgePath(boxOf(subject), boxOf(object), 0) : null;

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
        {/* `lg:flex-1`, not `flex-1`: in the narrow column layout a zero basis would collapse a
            box whose children are all positioned absolutely. */}
        <div ref={area} data-testid="f2-graph" className="relative h-[10em] w-full min-w-0 lg:w-auto lg:flex-1">
          <svg
            data-testid="f2-edges"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={layout ? `0 0 ${layout.w} ${layout.h}` : '0 0 100 100'}
            preserveAspectRatio="none"
          >
            <defs>
              {[['', INK], ['-pending', PENDING]].map(([suffix, colour]) => (
                <marker key={suffix} id={`${arrow}${suffix}`} viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={colour} />
                </marker>
              ))}
            </defs>
            {edges.map((edge, i) => (
              <path
                key={edge.key}
                data-testid={`f2-edge-${i}`}
                d={edgePath(boxOf(edge.subject_id), boxOf(edge.object_id), edge.bend).d}
                fill="none"
                stroke={INK}
                strokeWidth={2}
                markerEnd={directed ? `url(#${arrow})` : undefined}
              >
                <title>
                  {edge.merged.map((tri) => `${nameOf(tri.subject_id)} ${tri.predicate} ${nameOf(tri.object_id)}`).join(t('playground.and'))}
                </title>
              </path>
            ))}
            {pending && (
              <path
                data-testid="f2-pending"
                d={pending.d}
                fill="none"
                stroke={PENDING}
                strokeWidth={2}
                strokeDasharray="6 5"
                markerEnd={directed ? `url(#${arrow}-pending)` : undefined}
              />
            )}
          </svg>
          {frame.objects.map((o, i) => {
            const role =
              o.object_id === subject ? 'subject' : o.object_id === object ? 'object' : 'none';
            const measured = layout?.boxes[o.object_id];
            const place = nodePlace(i, frame.objects.length);
            return (
              <button
                key={o.object_id}
                type="button"
                data-testid={`node-${o.object_id}`}
                data-node={o.object_id}
                data-role={role}
                onClick={() => pick(o.object_id)}
                style={measured ? { left: measured.x, top: measured.y } : { left: `${place.left}%`, top: `${place.top}%` }}
                className={
                  role === 'none'
                    ? 'absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-slate-400 bg-white px-4 py-2 text-[1em]'
                    : 'absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border-2 border-slate-900 bg-slate-900 px-4 py-2 text-[1em] text-white'
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
