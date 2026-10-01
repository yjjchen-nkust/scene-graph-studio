import { useRef } from 'react';
import type { ModuleStep } from '../../content/registry';
import { useLocale } from '../../i18n/useLocale';
import { useRecordProgress } from '../../store/progress';
import { useFitDisplayMath } from './fitMath';
import { LECTURE_BASE_PX, LECTURE_PALETTE } from './palette';
import { formatClock } from './timer';
import { useStepper } from './useStepper';

export interface LectureShellProps {
  moduleId: string;
  title: string;
  steps: ModuleStep[];
}

/**
 * The lecture shell: one step, filling the projector, driven by the keyboard.
 *
 * Contracts §2.4 — a shell is a layout plus a step policy, and nothing else. It receives
 * `ModuleStep[]` and renders `node`; it does not know that a step may contain a lab, and it must
 * not learn, because the moment a shell special-cases a lab the two shells stop being two
 * layouts over one content base and become two applications.
 *
 * Every colour comes from `LECTURE_PALETTE`, whose ratios against the background are measured in
 * `palette.ts` and asserted in its test. Type is set once, in pixels, on the root: a lecture step
 * that inherited the study shell's size would be legible on the laptop driving the projector and
 * on nothing else in the room.
 */
export function LectureShell({ moduleId, title, steps }: LectureShellProps) {
  const { t } = useLocale();
  const stepper = useStepper(moduleId, steps);
  const step = steps[stepper.index];
  const stepRef = useRef<HTMLElement>(null);
  // Keyed on the step, so a formula is re-fitted when the slide changes and not only on resize.
  useFitDisplayMath(stepRef, `${moduleId}:${stepper.index}`);
  // A reader who watched the lecture has read the module, so both shells write the same record.
  useRecordProgress(moduleId, stepper.index + 1);

  if (!step) {
    return (
      <main
        data-testid="lecture-empty"
        style={{
          backgroundColor: LECTURE_PALETTE.background,
          color: LECTURE_PALETTE.muted,
          fontSize: LECTURE_BASE_PX,
        }}
        className="flex min-h-screen items-center justify-center p-12"
      >
        {t('lecture.empty')}
      </main>
    );
  }

  return (
    <main
      data-testid="lecture-root"
      style={{
        backgroundColor: LECTURE_PALETTE.background,
        color: LECTURE_PALETTE.text,
        fontSize: LECTURE_BASE_PX,
      }}
      // `h-screen` with the step scrolling inside it, not `min-h-screen` with the page
      // scrolling. Check 8 found 25 of 92 slides running past the bottom of an XGA panel, and
      // when the page scrolls the position indicator and the section clock go with it — so the
      // professor loses the two things that tell them where they are exactly when a slide is
      // too long. The header stays; the content moves.
      className="flex h-screen flex-col gap-8 overflow-hidden p-12"
    >
      <header className="flex shrink-0 items-baseline justify-between gap-8">
        <h1 data-testid="module-title" className="text-[1.25em] font-semibold">
          {title}
        </h1>
        <div className="flex items-baseline gap-8 text-[0.75em]">
          <button
            type="button"
            data-testid="open-presenter"
            // A named window, so pressing this twice reuses the second screen rather than
            // stacking a second copy of the notes on top of the first. No `noopener`: with it the
            // browser ignores the name, and the notes are this origin's own page.
            onClick={() => window.open('/lecture/notes', 'sgs-presenter')}
            className="rounded border px-3 py-1"
            style={{ borderColor: LECTURE_PALETTE.rule, color: LECTURE_PALETTE.muted }}
          >
            {t('presenter.open')}
          </button>
          {stepper.remainingSeconds !== null && (
            <span data-testid="timer" style={{ color: LECTURE_PALETTE.accent }}>
              <span className="mr-2" style={{ color: LECTURE_PALETTE.muted }}>
                {t('lecture.timer')}
              </span>
              <span className="font-mono tabular-nums">
                {formatClock(stepper.remainingSeconds)}
              </span>
            </span>
          )}
          <span
            data-testid="position"
            className="font-mono tabular-nums"
            style={{ color: LECTURE_PALETTE.muted }}
          >
            {stepper.index + 1} / {stepper.count}
          </span>
        </div>
      </header>

      <hr className="shrink-0" style={{ borderColor: LECTURE_PALETTE.rule }} />

      <section
        ref={stepRef}
        data-testid="step"
        key={step.id}
        aria-live="polite"
        className="prose-lecture min-h-0 flex-1 overflow-y-auto leading-relaxed"
      >
        {step.node}
      </section>
    </main>
  );
}
