import { render, screen } from '@testing-library/react';
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

  it('registers exactly the playgrounds M0 and M1 mount', () => {
    // Named, not derived. This asserted `PLAYGROUND_IDS` equalled
    // `Object.keys(PLAYGROUND_MOUNTS).sort()`, which is `mounts.tsx`'s own definition copied into
    // the test: it passes with the table empty, with a component missing, or with every entry
    // wrong. There is nothing for a derivation to drift from; what can drift is the set itself.
    expect(PLAYGROUND_IDS).toEqual(['F1', 'F2', 'F6', 'F8']);
    for (const id of PLAYGROUND_IDS) expect(PLAYGROUND_MOUNTS[id]).toBeTypeOf('function');
  });
});
