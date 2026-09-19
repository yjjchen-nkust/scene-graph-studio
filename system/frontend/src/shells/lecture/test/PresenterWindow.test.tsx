import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ModuleStep } from '../../../content/registry';
import { setLocale } from '../../../i18n/useLocale';
import { LectureShell } from '../LectureShell';
import { LECTURE_PALETTE } from '../palette';
import { PresenterView, PresenterWindow } from '../PresenterWindow';
import { PRESENTER_CHANNEL, type PresenterMessage } from '../useStepper';

const STEPS: ModuleStep[] = [
  {
    id: 's1',
    kind: 'prose',
    node: <p>first</p>,
    seconds_budget: 120,
    presenter_notes_en: 'Hold on the three photographs until somebody says the labels are equal.',
  },
  { id: 's2', kind: 'math', node: <p>second</p>, seconds_budget: 240 },
  { id: 's3', kind: 'lab', lab: 'L1', node: <p>third</p> },
];

function view(over: Partial<React.ComponentProps<typeof PresenterView>> = {}) {
  return render(
    <PresenterView
      title="Why scene graphs"
      steps={STEPS}
      stepIndex={0}
      remainingSeconds={120}
      elapsedSeconds={0}
      {...over}
    />,
  );
}

beforeEach(() => {
  setLocale('en');
});

describe('PresenterView', () => {
  it('renders the notes of the step it was given', () => {
    view();
    expect(screen.getByTestId('notes')).toHaveTextContent('Hold on the three photographs');
  });

  it('says a step has no notes rather than showing an empty pane', () => {
    view({ stepIndex: 1, remainingSeconds: 240 });
    expect(screen.getByTestId('notes-absent')).toBeInTheDocument();
    expect(screen.queryByTestId('notes')).not.toBeInTheDocument();
  });

  it('takes the notes from the locale it is displaying', () => {
    // The step carries an English note and no Chinese one. In zh-TW the pane must say there are
    // none, not fall back to English -- NFR-6 forbids a silent fallback anywhere.
    setLocale('zh-TW');
    view();
    expect(screen.getByTestId('notes-absent')).toBeInTheDocument();
    setLocale('en');
  });

  it('names the next step, so the professor knows what is coming', () => {
    view();
    expect(screen.getByTestId('next')).toHaveTextContent('s2');
  });

  it('says plainly when there is no next step', () => {
    view({ stepIndex: 2, remainingSeconds: null });
    expect(screen.getByTestId('next-absent')).toBeInTheDocument();
  });

  it('shows the section clock it was handed, and none when the step has no budget', () => {
    view();
    expect(screen.getByTestId('section-clock')).toHaveTextContent('2:00');

    view({ stepIndex: 2, remainingSeconds: null });
    expect(screen.getAllByTestId('section-clock')).toHaveLength(1);
  });

  it('marks a section past its budget without stopping the clock', () => {
    view({ remainingSeconds: -75 });
    const clock = screen.getByTestId('section-clock');
    expect(clock).toHaveTextContent('-1:15');
    expect(clock).toHaveAttribute('data-overtime', 'true');
    expect(clock.style.color).toBe(hexToRgb(LECTURE_PALETTE.danger));
  });

  it('does not call a section overtime while it still has a second left', () => {
    view({ remainingSeconds: 1 });
    expect(screen.getByTestId('section-clock')).toHaveAttribute('data-overtime', 'false');
  });

  it('shows the elapsed session, labelled as the window and not the lecture', () => {
    view({ elapsedSeconds: 3_725 });
    expect(screen.getByTestId('elapsed-clock')).toHaveTextContent('62:05');
  });
});

describe('PresenterWindow', () => {
  // Real timers: BroadcastChannel delivers on a macrotask, so the arrival has to be waited for
  // rather than flushed. Nothing here asserts on the elapsed clock, which is what would need them.
  function post(message: PresenterMessage) {
    const channel = new BroadcastChannel(PRESENTER_CHANNEL);
    channel.postMessage(message);
    channel.close();
  }

  it('waits, and says it is waiting, before the first message arrives', () => {
    render(<PresenterWindow resolve={() => ({ title: 'Why scene graphs', steps: STEPS })} />);
    expect(screen.getByTestId('presenter-idle')).toBeInTheDocument();
  });

  it('follows the lecture it is sent', async () => {
    render(<PresenterWindow resolve={() => ({ title: 'Why scene graphs', steps: STEPS })} />);
    post({ moduleId: 'm00', stepIndex: 0, remainingSeconds: 120 });
    expect(await screen.findByTestId('notes')).toHaveTextContent('Hold on the three photographs');

    post({ moduleId: 'm00', stepIndex: 1, remainingSeconds: 240 });
    expect(await screen.findByTestId('notes-absent')).toBeInTheDocument();
    expect(screen.getByTestId('section-clock')).toHaveTextContent('4:00');
  });

  it('asks for the position when it opens after the lecture has settled', async () => {
    // The defect this guards. The shell broadcasts from an effect keyed on the step and its
    // remaining seconds; a step with no `seconds_budget` has no clock, so the effect runs once
    // on entry and never again. `BroadcastChannel` retains nothing, so a presenter window
    // opened after that single message heard silence and waited for ever. It is not a corner:
    // every one of the fifteen modules opens on a step with no budget, and opening the module
    // before the presenter window is the order a professor works in.
    //
    // `STEPS[2]` is the step with no budget, and the shell is settled on it before the
    // presenter window exists.
    render(
      <MemoryRouter initialEntries={['/lecture/m/m00/2']}>
        <Routes>
          <Route
            path="/lecture/m/:moduleId/:stepIndex"
            element={<LectureShell moduleId="m00" title="Why scene graphs" steps={STEPS} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    // The wait is the test. `BroadcastChannel` delivers on a macrotask, so without it the shell's
    // single message is still in flight when the presenter subscribes and arrives anyway -- the
    // first version of this test passed against the unfixed code for exactly that reason. Real
    // windows are opened seconds apart, not microseconds, so the message must be spent first.
    await new Promise((resolve) => setTimeout(resolve, 20));

    render(<PresenterWindow resolve={() => ({ title: 'Why scene graphs', steps: STEPS })} />);

    expect(await screen.findByTestId('next-absent')).toBeInTheDocument();
    expect(screen.queryByTestId('presenter-idle')).not.toBeInTheDocument();
  });

  it('says so when the lecture is on a module it cannot resolve', async () => {
    render(<PresenterWindow resolve={() => null} />);
    post({ moduleId: 'm99', stepIndex: 0, remainingSeconds: null });
    expect(await screen.findByTestId('presenter-unknown')).toBeInTheDocument();
  });

  it('closing it leaves the lecture shell running', () => {
    const shell = render(
      <MemoryRouter initialEntries={['/lecture/m/m00/0']}>
        <Routes>
          <Route
            path="/lecture/m/:moduleId/:stepIndex"
            element={<LectureShell moduleId="m00" title="Why scene graphs" steps={STEPS} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    const presenter = render(
      <PresenterWindow resolve={() => ({ title: 'Why scene graphs', steps: STEPS })} />,
    );

    presenter.unmount();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(shell.getByTestId('position')).toHaveTextContent('2 / 3');
  });
});

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff})`;
}
