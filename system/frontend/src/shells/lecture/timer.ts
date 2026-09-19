import { useEffect, useState } from 'react';

/**
 * `mm:ss`, and negative past the budget.
 *
 * A section that has run four minutes long reads `-4:00`, not `0:00`. The point of the clock is
 * to say how far over the lecture is, and a clock that stops at zero answers the one question
 * the professor is actually asking.
 *
 * Truncation, not rounding: 59.9 seconds is `0:59`. Rounding would show `1:00` for a minute that
 * has not finished, which on the presenter window is the difference between "start wrapping up"
 * and "you are over".
 */
export function formatClock(seconds: number): string {
  const sign = seconds < 0 ? '-' : '';
  const total = Math.trunc(Math.abs(seconds));
  const minutes = Math.floor(total / 60);
  return `${sign}${minutes}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Seconds counted since the hook first ran, pausing when `running` goes false.
 *
 * This is the presenter window's own clock, and it deliberately measures the window's session
 * rather than the lecture's. `sgs-presenter` carries `{moduleId, stepIndex, remainingSeconds}`
 * and contracts §2.4 fixes that shape, so the window cannot know when the lecture started — it
 * only knows when it was opened. The interface therefore labels what this number is instead of
 * calling it the lecture's elapsed time, which it would be only by coincidence.
 */
export function useElapsedSeconds(running: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  return seconds;
}
