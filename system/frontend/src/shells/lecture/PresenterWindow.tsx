import { useEffect, useState } from 'react';
import { getMeta, getModule, type ModuleStep } from '../../content/registry';
import { useLocale, type Locale } from '../../i18n/useLocale';
import { LECTURE_PALETTE } from './palette';
import { formatClock, useElapsedSeconds } from './timer';
import {
  isPresenterHello,
  PRESENTER_CHANNEL,
  type PresenterHello,
  type PresenterMessage,
} from './useStepper';

export interface PresenterViewProps {
  title: string;
  steps: ModuleStep[];
  stepIndex: number;
  remainingSeconds: number | null;
  elapsedSeconds: number;
}

function notesFor(step: ModuleStep | undefined, locale: Locale): string | undefined {
  if (!step) return undefined;
  // Each locale file carries its own field, so exactly one is ever populated. Reading the other
  // when this one is empty would be the fallback NFR-6 forbids: a professor lecturing in
  // 繁體中文 would get an English pane and no sign that the Chinese notes were never written.
  return locale === 'en' ? step.presenter_notes_en : step.presenter_notes_zh;
}

/**
 * What the second screen shows. Pure: it is handed a position and renders it.
 *
 * Kept separate from the window that subscribes to the channel for the same reason `LectureShell`
 * is separate from its route — the layout is worth testing against a fixture, and the wiring is
 * worth testing once.
 */
export function PresenterView({
  title,
  steps,
  stepIndex,
  remainingSeconds,
  elapsedSeconds,
}: PresenterViewProps) {
  const { locale, t } = useLocale();
  const step = steps[stepIndex];
  const next = steps[stepIndex + 1];
  const notes = notesFor(step, locale);
  const overtime = remainingSeconds !== null && remainingSeconds < 0;

  return (
    <main
      data-testid="presenter-root"
      style={{ backgroundColor: LECTURE_PALETTE.background, color: LECTURE_PALETTE.text }}
      className="flex min-h-screen flex-col gap-6 p-8"
    >
      <header className="flex items-baseline justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide" style={{ color: LECTURE_PALETTE.muted }}>
            {title}
          </p>
          <p className="font-mono text-sm" style={{ color: LECTURE_PALETTE.muted }}>
            {step ? `${step.id} · ${step.kind}${step.kp ? ` · ${step.kp}` : ''}` : '—'}
          </p>
        </div>
        <div className="flex items-baseline gap-8">
          {remainingSeconds !== null && (
            <span
              data-testid="section-clock"
              data-overtime={String(overtime)}
              style={{ color: overtime ? LECTURE_PALETTE.danger : LECTURE_PALETTE.accent }}
              className="font-mono text-4xl tabular-nums"
            >
              {/* Colour is never the only channel, NFR-5. The sign leads the number, so an
                  overrun reads as an overrun in greyscale and to a colour-blind reader. */}
              {formatClock(remainingSeconds)}
            </span>
          )}
          <span className="text-right">
            <span
              className="block text-xs uppercase tracking-wide"
              style={{ color: LECTURE_PALETTE.muted }}
            >
              {t('presenter.elapsed')}
            </span>
            <span
              data-testid="elapsed-clock"
              className="font-mono text-xl tabular-nums"
              style={{ color: LECTURE_PALETTE.muted }}
            >
              {formatClock(elapsedSeconds)}
            </span>
          </span>
        </div>
      </header>

      <hr style={{ borderColor: LECTURE_PALETTE.rule }} />

      <section className="flex-1">
        <h2
          className="mb-3 text-xs font-semibold uppercase tracking-wide"
          style={{ color: LECTURE_PALETTE.muted }}
        >
          {t('presenter.notes')}
        </h2>
        {notes ? (
          <p data-testid="notes" className="whitespace-pre-line text-2xl leading-relaxed">
            {notes}
          </p>
        ) : (
          <p data-testid="notes-absent" className="text-xl" style={{ color: LECTURE_PALETTE.muted }}>
            {t('presenter.notes_absent')}
          </p>
        )}
      </section>

      <footer className="border-t pt-4" style={{ borderColor: LECTURE_PALETTE.rule }}>
        <h2
          className="mb-1 text-xs font-semibold uppercase tracking-wide"
          style={{ color: LECTURE_PALETTE.muted }}
        >
          {t('presenter.next')}
        </h2>
        {next ? (
          <p data-testid="next" className="font-mono text-lg">
            {next.id} · {next.kind}
            {next.lab ? ` · ${next.lab}` : ''}
            {next.kp ? ` · ${next.kp}` : ''}
          </p>
        ) : (
          <p data-testid="next-absent" className="text-lg" style={{ color: LECTURE_PALETTE.muted }}>
            {t('presenter.next_absent')}
          </p>
        )}
      </footer>
    </main>
  );
}

export interface ResolvedModule {
  title: string;
  steps: ModuleStep[];
}

/** Injectable so the wiring test does not have to compile fifteen modules of MDX to run. */
export type ModuleResolver = (moduleId: string, locale: Locale) => ResolvedModule | null;

const fromRegistry: ModuleResolver = (moduleId, locale) => {
  const meta = getMeta(moduleId, locale);
  const steps = getModule(moduleId, locale);
  if (!meta || !steps) return null;
  return { title: locale === 'en' ? meta.title_en : meta.title_zh, steps };
};

/**
 * `/lecture/notes` — a second browser window, not a second application.
 *
 * It subscribes to `sgs-presenter` and renders whatever the lecture shell last said. It issues
 * no command: a presenter window that could drive the deck would be a second set of controls on
 * a machine the professor is not looking at, and closing it must be free. That is why the shell
 * keeps no reference to it and why the test asserts the lecture survives its unmount.
 *
 * It does send one thing, and only at mount: `{ kind: 'hello' }`, meaning "is a lecture running,
 * and where is it?". A channel retains nothing, so before this the window could only see a
 * message posted after it had subscribed — and on a step with no `seconds_budget` the shell had
 * already posted its only one. See DEVIATIONS D86. A question is not a control.
 */
export function PresenterWindow({ resolve = fromRegistry }: { resolve?: ModuleResolver }) {
  const { locale, t } = useLocale();
  const [message, setMessage] = useState<PresenterMessage | null>(null);
  const elapsedSeconds = useElapsedSeconds(message !== null);

  useEffect(() => {
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(PRESENTER_CHANNEL);
    } catch {
      // No BroadcastChannel: the window renders its waiting state for ever rather than throwing.
      return;
    }
    channel.onmessage = (event) => {
      // Another presenter window's question, not the shell's answer. Two presenter windows on
      // one channel is a legitimate arrangement, and rendering a `hello` as a position would
      // put this window on a module named `undefined`.
      if (isPresenterHello(event.data)) return;
      setMessage(event.data as PresenterMessage);
    };
    // Subscribed, so an answer cannot be missed. A shell that is running replies with where it
    // is; if none is, nothing replies and the waiting pane stands, which is the honest result.
    channel.postMessage({ kind: 'hello' } satisfies PresenterHello);
    return () => channel.close();
  }, []);

  if (!message) {
    return (
      <main
        data-testid="presenter-idle"
        style={{ backgroundColor: LECTURE_PALETTE.background, color: LECTURE_PALETTE.muted }}
        className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center"
      >
        <p className="text-xl">{t('presenter.waiting')}</p>
        {/* A state with no remedy reads as a fault. This window is reached by its own URL as
            readily as from the shell's button, and arriving that way used to leave the reader
            with a condition and no next action. */}
        <p data-testid="presenter-idle-hint" className="max-w-md text-base">
          {t('presenter.waiting_hint')}
        </p>
      </main>
    );
  }

  const found = resolve(message.moduleId, locale);
  if (!found) {
    return (
      <main
        data-testid="presenter-unknown"
        style={{ backgroundColor: LECTURE_PALETTE.background, color: LECTURE_PALETTE.muted }}
        className="flex min-h-screen items-center justify-center p-8 text-center text-xl"
      >
        {t('presenter.unknown')}
        <span className="ml-2 font-mono">{message.moduleId}</span>
      </main>
    );
  }

  return (
    <PresenterView
      title={found.title}
      steps={found.steps}
      stepIndex={message.stepIndex}
      remainingSeconds={message.remainingSeconds}
      elapsedSeconds={elapsedSeconds}
    />
  );
}
