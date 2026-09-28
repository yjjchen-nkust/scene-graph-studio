import { createContext, useContext, type ReactNode } from 'react';

/**
 * The knobs, as real form controls.
 *
 * Every one of these is a `<input>`, `<select>` or `<button>` rather than a styled `div`, and
 * that is a requirement rather than a preference. The lecture shell's keyboard policy
 * (`useStepper.ts`) decides what a key belongs to by looking at the focused element:
 * `isTextEntry` gives every key to a focused `INPUT` of any type, and `consumesSpace` gives
 * Space to a focused `BUTTON`. A knob built from a div would receive neither rule, and the
 * professor would find out by skipping a slide in the room.
 *
 * Nothing here autofocuses. A playground that took focus on mount would hold the arrow keys for
 * the rest of the step.
 *
 * Each control carries `data-testid={id}` as well as `id`. `e2e/perf.spec.ts` addresses an
 * element by test id only, and a knob that could be reached by label alone would have to be
 * measured through the accessibility tree, whose name is the translated string -- so the
 * measurement would read differently in each locale.
 */

const LABEL = 'text-[1em] font-medium text-slate-700';

/**
 * Which part of a split playground the controls below belong to (D96).
 *
 * The study page renders every step, so the parts of one playground share a page, and a knob's
 * DOM id has to be unique there for its label to name it: repeated, each later label named the
 * first part's control. The test id stays the knob's own name, which is what the suites and the
 * URL address, so a part changes the id and nothing else.
 */
export const PartContext = createContext<number | undefined>(undefined);

function useDomId(id: string): string {
  const part = useContext(PartContext);
  return part === undefined ? id : `${id}.p${part}`;
}
const FIELD = 'rounded border border-slate-300 bg-white px-2 py-1 text-[1em]';

/**
 * Whether the frame around a playground and its `Readout`s use the tighter spacing M4 needs.
 *
 * `PlaygroundFrame`'s `dense` prop sets this; `Readout` reads it. The two components live apart,
 * and a prop cannot cross that gap on its own, so it is carried the same way `PartContext` carries
 * a part number across the same distance.
 *
 * Default `false`: F1, F2, F3, F6, F7, F8 and X1 (M0–M2) and E1 and E10 (M3) were already
 * measured at the spacing below with `dense` absent (D95–D102, `docs/VERIFICATION.md` §17–§25),
 * and nothing here may move a number those records already state. M4's E3, E4 and E7 always
 * render spec §4.1's full twelve-row list regardless of k, and E13 and X2 sit beside three-line
 * readouts that wrap onto a second row at 1024×768 — dense is how they fit the panel without a
 * third part, and it is opt-in rather than the default precisely so the other nine keep the
 * layout their own records measured.
 */
export const DensityContext = createContext<boolean>(false);

export function Toggle({
  id, label, checked, onChange,
}: { id: string; label: string; checked: boolean; onChange: (next: boolean) => void }) {
  const domId = useDomId(id);
  return (
    <span className="inline-flex items-center gap-2">
      <input
        id={domId}
        data-testid={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5"
      />
      <label htmlFor={domId} className={LABEL}>{label}</label>
    </span>
  );
}

export function Slider({
  id, label, value, min, max, step, onChange, valueLabel,
}: {
  id: string; label: string; value: number; min: number; max: number; step: number;
  onChange: (next: number) => void; valueLabel: string;
}) {
  const domId = useDomId(id);
  return (
    <span className="inline-flex items-center gap-2">
      <label htmlFor={domId} className={LABEL}>{label}</label>
      <input
        id={domId}
        data-testid={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        // Narrower than the browser default, so F7's three sliders share one row at 1024 px.
        className="w-24"
      />
      <span className="font-mono text-[1em] tabular-nums text-slate-600">{valueLabel}</span>
    </span>
  );
}

export function Choice({
  id, label, value, options, onChange, width,
}: {
  id: string; label: string; value: string;
  options: { value: string; label: string }[]; onChange: (next: string) => void;
  /** A cap on the field's width, for options too long to share a row; the list shows them whole. */
  width?: string;
}) {
  const domId = useDomId(id);
  return (
    <span className="inline-flex items-center gap-2">
      <label htmlFor={domId} className={LABEL}>{label}</label>
      <select
        id={domId}
        data-testid={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={width ? `${FIELD} ${width}` : FIELD}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </span>
  );
}

/**
 * One quantity with its origin beside it.
 *
 * `note` is not decoration. NFR-2 requires a number to carry where it came from, and in a
 * playground that source is arithmetic the student can check rather than a citation they must
 * trust — so the note holds the arithmetic.
 *
 * `id` is the test id and `label` is only ever displayed. The test id was built from the label
 * until 2026-09-20, which made `readout-Candidate triplets` an element that exists under `en` and
 * under no other locale — so every browser assertion addressing a readout was really a test of
 * the English build, passing because the describe block around it forced the locale. Ids are
 * namespaced by playground (`F1.candidates`) because the study shell renders all three in one
 * column and two of them count candidates.
 */
export function Readout({
  id, label, value, note,
}: { id: string; label: string; value: string; note: string }) {
  const dense = useContext(DensityContext);
  return (
    <div data-testid={`readout-${id}`} className="flex flex-col">
      <span
        className={
          dense
            ? 'text-[0.75em] uppercase leading-tight tracking-wide text-slate-700'
            : 'text-[0.875em] uppercase tracking-wide text-slate-700'
        }
      >
        {label}
      </span>
      {/* The value carries its own test id. `toHaveTextContent` is a substring match over the
          whole container, so an assertion on a number could be satisfied by a digit in the note
          or the label instead -- `note="|E| / 6"` made `toHaveTextContent('6')` pass for any
          value at all. Assertions on the number address this element. */}
      <span
        data-testid={`readout-${id}-value`}
        className={
          dense
            ? 'font-mono text-[1.5em] leading-none tabular-nums text-slate-900'
            : 'font-mono text-[1.5em] tabular-nums text-slate-900'
        }
      >
        {value}
      </span>
      <span
        className={
          dense
            ? 'font-mono text-[0.75em] leading-tight text-slate-700'
            : 'font-mono text-[0.875em] text-slate-700'
        }
      >
        {note}
      </span>
    </div>
  );
}

/**
 * Controls above, visual below, visual clipped.
 *
 * D71 records 25 of 92 slides already running past the bottom of a 1024x768 panel. When the
 * panel is short something has to give, and it must be the picture: a professor who cannot see
 * the whole photograph can still turn the knob and read the number, while one who cannot reach
 * the knob has no playground at all.
 *
 * `clip={false}` is for a playground whose visual is words and figures rather than a picture.
 * Clipping a picture costs its lower edge; clipping X1's sources or F7's legend cost the citation
 * and the key, and no scroll could reach them, because the clip sits inside the step that
 * scrolls (D93). Unclipped, the text runs past the panel like any long slide (D71) and the step's
 * own scroll reaches it; the controls are still above it and still in view.
 *
 * `dense` (default `false`) is M4's opt-in: `my-6`/`p-4`/`gap-y-3`/`mt-4` become `my-1`/`p-2`/
 * `gap-y-2`/`mt-1`, and every `Readout` inside reads the same choice from `DensityContext`. Left
 * `false`, this section renders byte-for-byte what it rendered at commit 2976fdb, which is the
 * spacing F1, F2, F3, F6, F7, F8, X1, E1 and E10 are already measured and recorded at
 * (D95–D102, `docs/VERIFICATION.md` §17–§25); turning it on for one of those nine would move a
 * number those records state without re-measuring it. E3, E4, E7, E13 and X2 pass `dense` because
 * their longest states do not fit 1024×768 at the spacing above: E3/E4/E7 always draw spec §4.1's
 * full twelve-row list beside three readouts, and E13/X2 sit beside readouts that wrap onto a
 * second row at that width.
 */
export function PlaygroundFrame({
  title, controls, children, clip = true, dense = false,
}: { title: string; controls: ReactNode; children: ReactNode; clip?: boolean; dense?: boolean }) {
  return (
    <DensityContext.Provider value={dense}>
      <section
        data-testid="playground-frame"
        className={
          dense
            ? 'my-1 rounded-lg border border-slate-200 bg-slate-50 p-2'
            : 'my-6 rounded-lg border border-slate-200 bg-slate-50 p-4'
        }
        aria-label={title}
      >
        <div
          data-testid="playground-controls"
          className={
            dense
              ? 'flex flex-wrap items-center gap-x-6 gap-y-2'
              : 'flex flex-wrap items-center gap-x-6 gap-y-3'
          }
        >
          {controls}
        </div>
        <div
          data-testid="playground-visual"
          className={
            dense
              ? clip ? 'mt-1 max-h-[46vh] overflow-hidden' : 'mt-1'
              : clip ? 'mt-4 max-h-[46vh] overflow-hidden' : 'mt-4'
          }
        >
          {children}
        </div>
      </section>
    </DensityContext.Provider>
  );
}
