import type { ReactNode } from 'react';

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
 */

const LABEL = 'text-base font-medium text-slate-700';
const FIELD = 'rounded border border-slate-300 bg-white px-2 py-1 text-base';

export function Toggle({
  id, label, checked, onChange,
}: { id: string; label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <span className="inline-flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5"
      />
      <label htmlFor={id} className={LABEL}>{label}</label>
    </span>
  );
}

export function Slider({
  id, label, value, min, max, step, onChange, valueLabel,
}: {
  id: string; label: string; value: number; min: number; max: number; step: number;
  onChange: (next: number) => void; valueLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <label htmlFor={id} className={LABEL}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="font-mono text-base tabular-nums text-slate-600">{valueLabel}</span>
    </span>
  );
}

export function Choice({
  id, label, value, options, onChange,
}: {
  id: string; label: string; value: string;
  options: { value: string; label: string }[]; onChange: (next: string) => void;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <label htmlFor={id} className={LABEL}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
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
 */
export function Readout({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div data-testid={`readout-${label}`} className="flex flex-col">
      <span className="text-sm uppercase tracking-wide text-slate-500">{label}</span>
      <span className="font-mono text-2xl tabular-nums text-slate-900">{value}</span>
      <span className="font-mono text-sm text-slate-500">{note}</span>
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
 */
export function PlaygroundFrame({
  title, controls, children,
}: { title: string; controls: ReactNode; children: ReactNode }) {
  return (
    <section
      data-testid="playground-frame"
      className="my-6 rounded-lg border border-slate-200 bg-slate-50 p-4"
      aria-label={title}
    >
      <div data-testid="playground-controls" className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {controls}
      </div>
      <div
        data-testid="playground-visual"
        className="mt-4 max-h-[46vh] overflow-hidden"
      >
        {children}
      </div>
    </section>
  );
}
