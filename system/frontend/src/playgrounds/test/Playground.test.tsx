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

  it('derives its id list from the mount table, so neither can drift from the other', () => {
    expect(PLAYGROUND_IDS).toEqual(Object.keys(PLAYGROUND_MOUNTS).sort());
  });
});
