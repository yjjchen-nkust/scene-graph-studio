import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModuleStep } from '../../../content/registry';
import { setLocale } from '../../../i18n/useLocale';
import { LectureShell } from '../LectureShell';
import { LECTURE_BASE_PX, LECTURE_PALETTE } from '../palette';

const STEPS: ModuleStep[] = [
  { id: 's1', kind: 'prose', node: <p>the first step</p>, seconds_budget: 65 },
  { id: 's2', kind: 'math', node: <p>the second step</p> },
  { id: 's3', kind: 'lab', lab: 'L2', node: <p>the third step</p>, seconds_budget: 300 },
];

function mount(entry: string, steps: ModuleStep[] = STEPS) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/lecture/m/:moduleId/:stepIndex"
          element={<LectureShell moduleId="m00" title="Why scene graphs" steps={steps} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LectureShell', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('renders one step and only one', () => {
    mount('/lecture/m/m00/1');
    expect(screen.getByText('the second step')).toBeInTheDocument();
    expect(screen.queryByText('the first step')).not.toBeInTheDocument();
    expect(screen.queryByText('the third step')).not.toBeInTheDocument();
  });

  it('shows the position so the room knows how much is left', () => {
    mount('/lecture/m/m00/1');
    expect(screen.getByTestId('position')).toHaveTextContent('2 / 3');
  });

  it('sets the projector base size on the shell itself', () => {
    mount('/lecture/m/m00/0');
    expect(screen.getByTestId('lecture-root').style.fontSize).toBe(`${LECTURE_BASE_PX}px`);
  });

  it('takes every colour from the measured palette', () => {
    mount('/lecture/m/m00/0');
    const root = screen.getByTestId('lecture-root');
    expect(root.style.backgroundColor).toBe(hexToRgb(LECTURE_PALETTE.background));
    expect(root.style.color).toBe(hexToRgb(LECTURE_PALETTE.text));
  });

  it('shows the section clock only where the step declares a budget', () => {
    mount('/lecture/m/m00/0');
    expect(screen.getByTestId('timer')).toHaveTextContent('1:05');

    mount('/lecture/m/m00/1');
    // Two shells are mounted now; the second has no clock, and a query that found the first
    // one's would pass for the wrong reason, so the count is what is asserted.
    expect(screen.getAllByTestId('timer')).toHaveLength(1);
  });

  it('advances through the deck on the keyboard alone', () => {
    mount('/lecture/m/m00/0');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('the second step')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('the first step')).toBeInTheDocument();
  });

  it('names the module, so a photographed slide says what it is', () => {
    mount('/lecture/m/m00/0');
    expect(screen.getByTestId('module-title')).toHaveTextContent('Why scene graphs');
  });

  it('says so plainly when a module has no steps rather than rendering a blank wall', () => {
    mount('/lecture/m/m00/0', []);
    expect(screen.getByTestId('lecture-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('position')).not.toBeInTheDocument();
  });

  it('opens the presenter window as a second browser window, not a second application', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    mount('/lecture/m/m00/0');

    fireEvent.click(screen.getByTestId('open-presenter'));
    expect(open).toHaveBeenCalledWith('/lecture/notes', expect.any(String));
    open.mockRestore();
  });

  it('opens the presenter window by name and without noopener, so a second press reuses it', () => {
    // With `noopener` the browser ignores the name and every press opened another window.
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    mount('/lecture/m/m00/0');

    fireEvent.click(screen.getByTestId('open-presenter'));
    expect(open).toHaveBeenCalledTimes(1);
    const [url, name, features] = open.mock.calls[0]!;
    expect([url, name]).toEqual(['/lecture/notes', 'sgs-presenter']);
    expect(String(features ?? '')).not.toContain('noopener');
    open.mockRestore();
  });

  it('does not advance on Space while the presenter button has focus', () => {
    // The button is in the tab order and the browser activates it on Space. Advancing as well
    // would open the second window and skip a slide on one keypress.
    mount('/lecture/m/m00/0');
    const button = screen.getByTestId('open-presenter');
    button.focus();

    fireEvent.keyDown(button, { key: ' ' });
    expect(screen.getByTestId('position')).toHaveTextContent('1 / 3');
  });

  it('still advances on an arrow while the presenter button has focus', () => {
    // An arrow means nothing to a button, so it belongs to the deck. The rule is about the key
    // the focused element would consume, not about focus as such.
    mount('/lecture/m/m00/0');
    screen.getByTestId('open-presenter').focus();

    fireEvent.keyDown(screen.getByTestId('open-presenter'), { key: 'ArrowRight' });
    expect(screen.getByTestId('position')).toHaveTextContent('2 / 3');
  });

  it('marks the step region as live so a screen reader follows the deck', () => {
    mount('/lecture/m/m00/0');
    expect(screen.getByTestId('step')).toHaveAttribute('aria-live', 'polite');
  });
});

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff})`;
}
