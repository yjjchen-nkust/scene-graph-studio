import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { PRESENTER_CHANNEL, useStepper, type PresenterMessage } from '../useStepper';

const STEPS = [
  { id: 's1', seconds_budget: 60 },
  { id: 's2' },
  { id: 's3', seconds_budget: 30 },
];

function Probe() {
  const location = useLocation();
  return <output data-testid="url">{location.pathname}</output>;
}

function Harness({ withInput = false, withSelect = false }: { withInput?: boolean; withSelect?: boolean }) {
  const stepper = useStepper('m00', STEPS);
  return (
    <div>
      <output data-testid="index">{stepper.index}</output>
      <output data-testid="remaining">{String(stepper.remainingSeconds)}</output>
      {withInput && <input data-testid="editor" defaultValue="" />}
      {withSelect && (
        <select data-testid="chooser" defaultValue="a">
          <option value="a">a</option>
          <option value="b">b</option>
        </select>
      )}
      <Probe />
    </div>
  );
}

function mount(entry: string, props: { withInput?: boolean; withSelect?: boolean } = {}) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/lecture/m/:moduleId/:stepIndex" element={<Harness {...props} />} />
      </Routes>
    </MemoryRouter>,
  );
}

const index = () => Number(screen.getByTestId('index').textContent);

describe('useStepper', () => {
  it('advances on ArrowRight and Space, retreats on ArrowLeft', () => {
    mount('/lecture/m/m00/0');
    expect(index()).toBe(0);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(index()).toBe(1);

    fireEvent.keyDown(window, { key: ' ' });
    expect(index()).toBe(2);

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(index()).toBe(1);
  });

  it('stops at the ends rather than wrapping', () => {
    mount('/lecture/m/m00/0');

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(index()).toBe(0);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(index()).toBe(2);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(index()).toBe(2);
  });

  it('does not steal keys while a text input has focus', () => {
    // The TEC editor in L5 lives inside a lecture step. Typing a space must not advance the slide.
    mount('/lecture/m/m00/0', { withInput: true });
    const editor = screen.getByTestId('editor');
    editor.focus();

    fireEvent.keyDown(editor, { key: ' ' });
    fireEvent.keyDown(editor, { key: 'ArrowRight' });
    fireEvent.keyDown(editor, { key: 'ArrowLeft' });

    expect(index()).toBe(0);
  });

  it('does not steal arrow keys while a select has focus', () => {
    // `isTextEntry` names SELECT alongside INPUT and TEXTAREA, and nothing tested that branch:
    // deleting `|| node.tagName === 'SELECT'` left the whole unit suite green. Five of the
    // twelve knobs the three M0 playgrounds carry are `Choice`, which renders a `<select>`, so
    // the regression is a professor pressing Right to move to the next option and changing the
    // slide instead. Spec §4.2 requires every knob to be operable from the keyboard.
    mount('/lecture/m/m00/0', { withSelect: true });
    const chooser = screen.getByTestId('chooser');
    chooser.focus();

    fireEvent.keyDown(chooser, { key: 'ArrowRight' });
    fireEvent.keyDown(chooser, { key: 'ArrowLeft' });
    fireEvent.keyDown(chooser, { key: ' ' });

    expect(index()).toBe(0);
  });

  it('puts the step index in the URL so any step is bookmarkable', () => {
    mount('/lecture/m/m00/0');
    expect(screen.getByTestId('url').textContent).toBe('/lecture/m/m00/0');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('url').textContent).toBe('/lecture/m/m00/1');
  });

  it('reads its position from the URL rather than from its own state', () => {
    // Entering mid-deck is what a bookmark is for; the hook must not reset to zero.
    mount('/lecture/m/m00/2');
    expect(index()).toBe(2);
  });

  it('clamps an out-of-range URL index instead of rendering nothing', () => {
    mount('/lecture/m/m00/97');
    expect(index()).toBe(2);
  });

  it('posts position and remaining time on the presenter channel', async () => {
    const seen: PresenterMessage[] = [];
    const channel = new BroadcastChannel(PRESENTER_CHANNEL);
    channel.onmessage = (event) => seen.push(event.data as PresenterMessage);

    mount('/lecture/m/m00/0');
    await vi.waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(seen.at(-1)).toEqual({ moduleId: 'm00', stepIndex: 0, remainingSeconds: 60 });

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await vi.waitFor(() => expect(seen.at(-1)?.stepIndex).toBe(1));
    // s2 declares no budget, so there is no countdown to report rather than a fabricated zero.
    expect(seen.at(-1)).toEqual({ moduleId: 'm00', stepIndex: 1, remainingSeconds: null });

    channel.close();
  });

  it('counts the budget down once a second and keeps going past zero', () => {
    // Fake timers only here: `vi.waitFor` in the channel test needs the real clock, and a
    // globally faked clock with `shouldAdvanceTime` would let a stray tick land mid-assertion.
    vi.useFakeTimers();
    try {
      mount('/lecture/m/m00/2');
      expect(screen.getByTestId('remaining').textContent).toBe('30');

      act(() => {
        vi.advanceTimersByTime(31_000);
      });
      expect(screen.getByTestId('remaining').textContent).toBe('-1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('restarts the budget when the step changes', () => {
    vi.useFakeTimers();
    try {
      mount('/lecture/m/m00/0');
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(screen.getByTestId('remaining').textContent).toBe('50');

      // Two separate dispatches, not one batched `act`: batching would leave the second
      // handler holding the first render's index and the deck would advance only once.
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(index()).toBe(2);
      expect(screen.getByTestId('remaining').textContent).toBe('30');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not lose a keypress that arrives before the previous one has rendered', () => {
    // A held arrow key repeats about thirty times a second, and a professor advancing two slides
    // quickly presses faster than React commits. Both presses were computed from the same
    // rendered index until this was fixed, so the deck moved one step for two presses. Found by
    // the Playwright walkthrough of M04, not by any unit test.
    mount('/lecture/m/m00/0');
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
    });
    expect(index()).toBe(2);
  });

  it('holds at the end even when the presses arrive faster than the renders', () => {
    mount('/lecture/m/m00/0');
    act(() => {
      for (let i = 0; i < 6; i += 1) fireEvent.keyDown(window, { key: 'ArrowRight' });
    });
    expect(index()).toBe(2);
  });

  it('follows the route when it moves for a reason other than a keypress', () => {
    // A bookmark, or the back button. Whatever the hook last asked for is abandoned.
    const { unmount } = mount('/lecture/m/m00/0');
    unmount();
    mount('/lecture/m/m00/2');
    expect(index()).toBe(2);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(index()).toBe(1);
  });

  it('stops listening once unmounted, so a closed lecture cannot move', () => {
    const { unmount } = mount('/lecture/m/m00/0');
    unmount();
    // Nothing to assert on screen; the failure this guards is a listener left on `window`
    // firing into a torn-down tree, which React reports as an error.
    expect(() => fireEvent.keyDown(window, { key: 'ArrowRight' })).not.toThrow();
  });
});

describe('useStepper and a playground split across steps', () => {
  // s2 and s3 are the two parts of X1; s1 and s4 are something else.
  const PARTS = [{ id: 's1' }, { id: 's2', kp: 'X1' }, { id: 's3', kp: 'X1' }, { id: 's4', kp: 'F7' }];

  function Where() {
    const location = useLocation();
    return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
  }

  function Parts() {
    useStepper('m01', PARTS);
    return <Where />;
  }

  function at(entry: string) {
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/lecture/m/:moduleId/:stepIndex" element={<Parts />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  const where = () => screen.getByTestId('where').textContent;

  it('carries the knobs from one part to the next, in both directions', () => {
    at('/lecture/m/m01/1?X1.r=sgb-v1');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(where()).toBe('/lecture/m/m01/2?X1.r=sgb-v1');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(where()).toBe('/lecture/m/m01/1?X1.r=sgb-v1');
  });

  it('drops them on leaving the playground, as every other step change does', () => {
    at('/lecture/m/m01/2?X1.r=sgb-v1');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(where()).toBe('/lecture/m/m01/3');
  });

  it('carries the query the pending step would have, when presses outrun the renders', () => {
    // From F7 back through X1's two parts before either renders: the first press opens part 2
    // with no query, since F7's knobs are not X1's, so the second must carry that empty query
    // to part 1 and not F7's, which is still the rendered one.
    at('/lecture/m/m01/3?X1.r=sgb-v1');
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
    });
    expect(where()).toBe('/lecture/m/m01/1');
  });

  it('does not carry a query into a playground from a step that is not part of it', () => {
    at('/lecture/m/m01/0?X1.r=sgb-v1');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(where()).toBe('/lecture/m/m01/1');
  });
});

describe('useStepper and a demo split across steps', () => {
  // D-T's parts 3 and 4, then D-V's part 1: two demos side by side, each carrying its own frame.
  const DEMOS = [{ id: 's9', demo: 'DT' }, { id: 's10', demo: 'DT' }, { id: 's11', demo: 'DV' }];

  function Where() {
    const location = useLocation();
    return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
  }

  function Demos() {
    useStepper('m00', DEMOS);
    return <Where />;
  }

  it('carries the query between two parts of one demo, and not into the next demo', () => {
    render(
      <MemoryRouter initialEntries={['/lecture/m/m00/0?DT.frame=m0-demo-096']}>
        <Routes>
          <Route path="/lecture/m/:moduleId/:stepIndex" element={<Demos />} />
        </Routes>
      </MemoryRouter>,
    );
    const where = () => screen.getByTestId('where').textContent;
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(where()).toBe('/lecture/m/m00/1?DT.frame=m0-demo-096');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(where()).toBe('/lecture/m/m00/2');
  });
});

describe('useStepper and the clip', () => {
  function Clip() {
    const stepper = useStepper('m00', STEPS);
    return (
      <div>
        <output data-testid="index">{stepper.index}</output>
        {/* jsdom makes a <video controls> focusable only through tabIndex; a browser does it alone. */}
        <video data-testid="clip" controls tabIndex={0} />
      </div>
    );
  }

  it('yields Space to a focused video', () => {
    // ArrowRight still advances: an arrow means nothing to the clip, as to a button.
    render(
      <MemoryRouter initialEntries={['/lecture/m/m00/0']}>
        <Routes>
          <Route path="/lecture/m/:moduleId/:stepIndex" element={<Clip />} />
        </Routes>
      </MemoryRouter>,
    );
    const clip = screen.getByTestId('clip');
    clip.focus();
    expect(document.activeElement).toBe(clip);

    fireEvent.keyDown(clip, { key: ' ' });
    expect(Number(screen.getByTestId('index').textContent)).toBe(0);

    fireEvent.keyDown(clip, { key: 'ArrowRight' });
    expect(Number(screen.getByTestId('index').textContent)).toBe(1);
  });
});

describe('useStepper keyboard policy', () => {
  function Modifiers() {
    const stepper = useStepper('m00', STEPS);
    return <output data-testid="index">{stepper.index}</output>;
  }

  it('ignores a modified arrow, which belongs to the browser', () => {
    render(
      <MemoryRouter initialEntries={['/lecture/m/m00/0']}>
        <Routes>
          <Route path="/lecture/m/:moduleId/:stepIndex" element={<Modifiers />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true });
    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true });
    expect(Number(screen.getByTestId('index').textContent)).toBe(0);
  });

  it('ignores keys while a contenteditable region has focus', () => {
    function Editable() {
      const stepper = useStepper('m00', STEPS);
      return (
        <div>
          <output data-testid="index">{stepper.index}</output>
          <div contentEditable suppressContentEditableWarning data-testid="rich" tabIndex={0} />
        </div>
      );
    }

    render(
      <MemoryRouter initialEntries={['/lecture/m/m00/0']}>
        <Routes>
          <Route path="/lecture/m/:moduleId/:stepIndex" element={<Editable />} />
        </Routes>
      </MemoryRouter>,
    );

    const rich = screen.getByTestId('rich');
    rich.focus();
    fireEvent.keyDown(rich, { key: 'ArrowRight' });
    expect(Number(screen.getByTestId('index').textContent)).toBe(0);
  });
});
