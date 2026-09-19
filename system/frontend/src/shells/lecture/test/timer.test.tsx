import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatClock, useElapsedSeconds } from '../timer';

describe('formatClock', () => {
  it('pads the seconds so the clock does not jump width', () => {
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(600)).toBe('10:00');
    expect(formatClock(0)).toBe('0:00');
  });

  it('keeps counting past the budget, with a sign', () => {
    expect(formatClock(-1)).toBe('-0:01');
    expect(formatClock(-240)).toBe('-4:00');
  });

  it('does not round a fractional second into the wrong minute', () => {
    expect(formatClock(59.9)).toBe('0:59');
    expect(formatClock(-59.9)).toBe('-0:59');
  });
});

function Elapsed({ running }: { running: boolean }) {
  return <output data-testid="elapsed">{useElapsedSeconds(running)}</output>;
}

const read = () => Number(screen.getByTestId('elapsed').textContent);

describe('useElapsedSeconds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at zero and counts once a second', () => {
    render(<Elapsed running />);
    expect(read()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(read()).toBe(3);
  });

  it('does not count while it is not running', () => {
    render(<Elapsed running={false} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(read()).toBe(0);
  });

  it('resumes from where it stopped rather than restarting', () => {
    const { rerender } = render(<Elapsed running />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    rerender(<Elapsed running={false} />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(read()).toBe(4);

    rerender(<Elapsed running />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(read()).toBe(6);
  });

  it('stops its interval on unmount', () => {
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = render(<Elapsed running />);
    unmount();
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });
});
