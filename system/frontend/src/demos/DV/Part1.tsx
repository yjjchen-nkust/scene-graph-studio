import { useState, type ReactNode } from 'react';
import { useLocale } from '../../i18n/useLocale';
import { ClipPlayer } from '../ClipPlayer';
import { CLIP_SIZE, VLM } from '../data';

/** The clip's height at most, in viewport heights, as D-T's first part has it. */
const PICTURE_VH = 28;

/** The line after a section's header in the prompt as sent, or nothing if it has no such header. */
function lineAfter(lines: readonly string[], header: string): string | undefined {
  const at = lines.indexOf(header);
  return at === -1 ? undefined : lines[at + 1];
}

const TERM = 'whitespace-nowrap font-mono font-semibold';
const CHIP = 'rounded border border-slate-500 bg-white px-1';

/** One of the prompt's parts: its name on the left, what the prompt says on the right. */
function Row({ name, gloss, children }: { name: string; gloss?: string; children: ReactNode }) {
  return (
    <>
      <dt className="whitespace-nowrap">
        <span className={TERM}>{name}</span>
        {gloss && ` ${gloss}`}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

/**
 * D-V, part 1: the TEC prompt.
 *
 * The clip beside step 1's prompt, cut into the parts the paper names: INFORMATION (its first
 * line, what the model is given), the triplet extraction criteria O, P and E (the twelve object
 * categories and the seven predicates as chips, the two examples with their analyses) and FORMAT
 * (the prompt's OUTPUT line). Each is read from the recorded prompt and from `VLM.O`, `VLM.P` and
 * `VLM.E`, the lists the prompt was built from; nothing is retyped here. The prompt is the same
 * for every frame, and only the image sent with it changes, so the clip's ticks choose the frame
 * the later parts carry.
 *
 * The whole prompt, verbatim, is behind a disclosure below. Open, it takes the parts' place and
 * scrolls within its own box: at 18 px its 27 lines are taller than a 1024×768 panel, and the part
 * must not run past the panel in any state.
 */
export function Part1({ frameId, onPick }: { frameId: string; onPick: (id: string) => void }) {
  const { t } = useLocale();
  const [whole, setWhole] = useState(false);
  const lines = VLM.prompt_step1.split('\n');
  const information = lineAfter(lines, 'INFORMATION');
  const format = lineAfter(lines, 'OUTPUT');

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
      <div
        className="lg:w-56 lg:shrink-0 xl:w-auto xl:flex-1"
        style={{ maxWidth: `calc(${PICTURE_VH}vh * ${CLIP_SIZE.width} / ${CLIP_SIZE.height})` }}
      >
        <ClipPlayer value={frameId} onPick={onPick} maxVh={PICTURE_VH} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-[0.75em] leading-tight text-slate-900">
        <p className="text-slate-700">{t('demo.dv.prompt_caption').replace('{frames}', String(VLM.frames.length))}</p>
        {!whole && (
          <dl data-testid="dv-parts" className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1">
            {information !== undefined && (
              <Row name="INFORMATION">
                <span data-testid="dv-information">{information}</span>
              </Row>
            )}
            <Row name="O" gloss={t('demo.dv.o')}>
              <ul data-testid="dv-o" className="flex flex-wrap gap-1">
                {VLM.O.map((o) => (
                  <li key={o} className={CHIP}>{o}</li>
                ))}
              </ul>
            </Row>
            <Row name="P" gloss={t('demo.dv.p')}>
              <ul data-testid="dv-p" className="flex flex-wrap gap-1">
                {VLM.P.map((p) => (
                  <li key={p} className={CHIP}>{p}</li>
                ))}
              </ul>
            </Row>
            <Row name="E" gloss={t('demo.dv.e')}>
              <ul data-testid="dv-e" className="flex flex-col gap-0.5">
                {VLM.E.map((e) => (
                  <li key={`${e.kind}:${e.triplet.join('|')}`}>
                    <span className="font-mono">{`[${e.kind}] <${e.triplet.join(', ')}>`}</span>
                    {` ${e.analysis}`}
                  </li>
                ))}
              </ul>
            </Row>
            {format !== undefined && (
              <Row name="FORMAT">
                <span data-testid="dv-format">{format}</span>
              </Row>
            )}
          </dl>
        )}
        <details
          data-testid="dv-prompt-whole"
          open={whole}
          onToggle={(e) => setWhole(e.currentTarget.open)}
        >
          <summary className="cursor-pointer font-semibold">{t('demo.dv.prompt_whole')}</summary>
          {/* Focusable, so the keyboard can scroll it: the stepper keeps ← and → and yields ↑ and ↓. */}
          <pre
            data-testid="dv-prompt-text"
            tabIndex={0}
            className="mt-1 max-h-[36vh] overflow-y-auto whitespace-pre-wrap rounded border border-slate-300 bg-white p-1 font-mono text-[1em] leading-tight"
          >
            {VLM.prompt_step1}
          </pre>
        </details>
      </div>
    </div>
  );
}
