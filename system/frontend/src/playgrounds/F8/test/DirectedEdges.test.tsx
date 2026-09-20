import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { DirectedEdges } from '../DirectedEdges';

beforeEach(() => setLocale('en'));

function at(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/m/m00${search}`]}>
      <DirectedEdges />
    </MemoryRouter>,
  );
}

describe('F8', () => {
  it('opens on a triplet the annotator wrote, and says it is recorded', () => {
    at();
    // ph-001 relationship 1: box --on--> table.
    expect(screen.getByTestId('f8-sentence')).toHaveTextContent('box on table');
    expect(screen.getByTestId('f8-status')).toHaveTextContent('Recorded in E');
  });

  it('swapping reverses the sentence and the status', () => {
    at();
    fireEvent.click(screen.getByLabelText('Swap subject and object'));
    expect(screen.getByTestId('f8-sentence')).toHaveTextContent('table on box');
    expect(screen.getByTestId('f8-status')).toHaveTextContent('Not recorded in E');
  });

  it('never says true or false, because not recorded is a different claim', () => {
    at();
    fireEvent.click(screen.getByLabelText('Swap subject and object'));
    const status = screen.getByTestId('f8-status').textContent ?? '';
    expect(status.toLowerCase()).not.toMatch(/\bfalse\b/);
    expect(status.toLowerCase()).not.toMatch(/\btrue\b/);
    expect(screen.getByTestId('f8-note')).toHaveTextContent('not the same claim as false');
  });

  it('the symmetric-reading case is still absent from E, which is the teaching moment', () => {
    // ph-001 relationship 2: person --near--> table. `near` reads as symmetric; the annotator
    // wrote one direction.
    at('?F8.rel=2');
    expect(screen.getByTestId('f8-sentence')).toHaveTextContent('person near table');
    fireEvent.click(screen.getByLabelText('Swap subject and object'));
    expect(screen.getByTestId('f8-status')).toHaveTextContent('Not recorded in E');
  });

  // The default `F8.rel` was the literal 1, which is a relationship id in ph-001 and in no other
  // frame of the slice — ids are unique across it, so ph-002 carries 7 to 12. Changing frame reset
  // the knob to 1 and relied on the `?? relationships[0]` fallback to recover, which works and
  // means the default is meaningless for five of the six frames.
  it('opens a newly chosen frame on that frame’s own first relationship', () => {
    at();
    fireEvent.change(screen.getByLabelText('Frame'), { target: { value: 'ph-002' } });
    const chosen = screen.getByLabelText('Triplet') as HTMLSelectElement;
    expect(chosen.value).toBe(chosen.options[0]!.value);
    expect(Number(chosen.value)).toBeGreaterThan(6);
  });

  it('reads a swap value the URL invented as the default, not as its opposite', () => {
    // `=== 1` read every out-of-range value as off, which happens to be the default here; the
    // same construction on F1's layer toggles turned layers off that default to on.
    at('?F8.swap=2');
    expect(screen.getByTestId('f8-status')).toHaveTextContent('Recorded in E');
  });

  it('does not take focus when it mounts', () => {
    at();
    expect(document.activeElement).toBe(document.body);
  });

  it('falls back to the frame’s first relationship when the URL names one it does not have', () => {
    at('?F8.rel=999');
    expect(screen.getByTestId('f8-sentence')).toHaveTextContent('box on table');
  });
});
