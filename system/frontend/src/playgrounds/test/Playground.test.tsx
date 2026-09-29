import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/useLocale';
import { Playground } from '../Playground';
import { PLAYGROUND_IDS, PLAYGROUND_MOUNTS } from '../mounts';

beforeEach(() => setLocale('en'));

describe('Playground', () => {
  it('names the knowledge point it cannot mount, rather than rendering nothing', () => {
    // A silent empty box in a lecture is the failure this codebase keeps legislating against;
    // UnknownLab is the same answer for the same reason.
    render(<Playground kp="F99" />);
    expect(screen.getByTestId('playground-unknown')).toBeInTheDocument();
    expect(screen.getByTestId('playground-unknown')).toHaveTextContent('F99');
  });

  it('registers exactly the playgrounds M0 to M5 mount', () => {
    // Named, not derived. This asserted `PLAYGROUND_IDS` equalled
    // `Object.keys(PLAYGROUND_MOUNTS).sort()`, which is `mounts.tsx`'s own definition copied into
    // the test: it passes with the table empty, with a component missing, or with every entry
    // wrong. There is nothing for a derivation to drift from; what can drift is the set itself.
    expect(PLAYGROUND_IDS).toEqual(['E1', 'E10', 'E13', 'E3', 'E4', 'E7', 'F1', 'F2', 'F3', 'F6', 'F7', 'F8', 'T1', 'T2', 'X1', 'X2']);
    for (const id of PLAYGROUND_IDS) expect(PLAYGROUND_MOUNTS[id]).toBeTypeOf('function');
  });

  it("gives exactly M4's five playgrounds and M5's two the dense frame, and every other the measured one", () => {
    // `dense` is M4's opt-in (D106): the nine earlier playgrounds were measured at the base classes
    // (D95 to D102), and one of them turned dense would move a number their records state. T1 and
    // T2 have no earlier measurement to move, and dense is what fits T2's six-row table beside
    // three readouts at 1024×768 (D111).
    const DENSE = 'my-1 rounded-lg border border-slate-200 bg-slate-50 p-2';
    const BASE = 'my-6 rounded-lg border border-slate-200 bg-slate-50 p-4';
    const dense: string[] = [];
    for (const id of PLAYGROUND_IDS) {
      const Mount = PLAYGROUND_MOUNTS[id]!;
      const { container, unmount } = render(
        <MemoryRouter initialEntries={['/m/m00']}>
          <Mount />
        </MemoryRouter>,
      );
      const frames = [...container.querySelectorAll('[data-testid="playground-frame"]')];
      expect(frames.length, id).toBeGreaterThan(0);
      const classes = new Set(frames.map((frame) => frame.className));
      expect(classes.size, id).toBe(1);
      const [className] = classes;
      expect([DENSE, BASE], id).toContain(className);
      if (className === DENSE) dense.push(id);
      unmount();
    }
    expect(dense.sort()).toEqual(['E13', 'E3', 'E4', 'E7', 'T1', 'T2', 'X2']);
  });
});
