import type { ReactNode } from 'react';
import { DensityContext } from '../playgrounds/controls';

/**
 * Controls above, visual below, and where the visual came from beneath it.
 *
 * `PlaygroundFrame`'s dense layout (D106, D111), which the demo parts need at 1024×768 for the
 * same reason M4's and M5's playgrounds do: readouts beside a photograph or a list. It is always
 * dense, so every `Readout` inside reads `true` from `DensityContext`, and never clipped: a part
 * is words and figures beside its pictures, and a word under a clip is beyond the reach of the
 * step's scroll (D93).
 *
 * `provenance` is not decoration. A demo replays a recorded artefact, and the line names the model
 * that produced it, when, and whether it was measured or recorded and replayed, as NFR-2 requires
 * of every number.
 */
export function DemoFrame({
  title, controls, provenance, children,
}: { title: string; controls: ReactNode; provenance: ReactNode; children: ReactNode }) {
  return (
    <DensityContext.Provider value>
      <section
        data-testid="demo-frame"
        className="my-1 rounded-lg border border-slate-200 bg-slate-50 p-2"
        aria-label={title}
      >
        <div data-testid="demo-controls" className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {controls}
        </div>
        <div data-testid="demo-visual" className="mt-1">
          {children}
        </div>
        <p data-testid="demo-provenance" className="mt-1 font-mono text-[0.75em] leading-tight text-slate-700">
          {provenance}
        </p>
      </section>
    </DensityContext.Provider>
  );
}
