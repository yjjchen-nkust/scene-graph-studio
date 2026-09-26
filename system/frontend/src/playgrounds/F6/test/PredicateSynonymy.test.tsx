import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { PredicateSynonymy } from '../PredicateSynonymy';

beforeEach(() => setLocale('en'));

function at(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/m/m01${search}`]}>
      <PredicateSynonymy />
    </MemoryRouter>,
  );
}

const value = (id: string) => screen.getByTestId(`readout-${id}-value`);

describe('F6', () => {
  it('counts the predicate classes in use, and the merge removes three of them', () => {
    at();
    expect(value('F6.predicates')).toHaveTextContent(/^36$/);
    fireEvent.click(screen.getByTestId('F6.mp'));
    expect(value('F6.predicates')).toHaveTextContent(/^33$/);
  });

  it('writes the merged class out as the sum of its members', () => {
    at('?F6.mp=1');
    expect(value('F6.group')).toHaveTextContent(/^408$/);
    expect(screen.getByTestId('readout-F6.group')).toHaveTextContent(
      'on 382 + above 11 + over 5 + sitting on 10 = 408',
    );
  });

  it('merges the three names for people, independently of the predicates', () => {
    at('?F6.mo=1');
    expect(value('F6.objects')).toHaveTextContent(/^113$/);
    expect(screen.getByTestId('readout-F6.objects')).toHaveTextContent('man 56 + person 52 + people 19 = 127');
    expect(value('F6.predicates')).toHaveTextContent(/^36$/);
  });

  it('opens on a teaching edge: not recorded without the merge, recorded in E′ with it', () => {
    at();
    expect(screen.getByTestId('f6-status')).toHaveAttribute('data-recorded', 'false');
    fireEvent.click(screen.getByTestId('F6.mp'));
    expect(screen.getByTestId('f6-status')).toHaveAttribute('data-recorded', 'true');
    expect(screen.getByTestId('f6-status')).toHaveTextContent('Recorded in E′');
  });

  it('frame 228: glass sitting on table, with on substituted', () => {
    at('?F6.img=228&F6.rel=5');
    expect(screen.getByTestId('f6-annotated')).toHaveTextContent('glass sitting on table');
    expect(screen.getByTestId('f6-sentence')).toHaveTextContent('glass on table');
    expect(screen.getByTestId('f6-status')).toHaveTextContent('Not recorded in E');
  });

  it('a substitute from the URL outside the group falls back to one inside it', () => {
    at('?F6.img=228&F6.rel=5&F6.sub=eating');
    expect(screen.getByTestId('f6-sentence')).toHaveTextContent('glass on table');
  });

  it('a substitute equal to the edge\'s own predicate is not offered', () => {
    at('?F6.img=228&F6.rel=5&F6.sub=sitting%20on');
    expect(screen.getByTestId('f6-sentence')).toHaveTextContent('glass on table');
    const options = [...screen.getByTestId('F6.sub').querySelectorAll('option')].map((o) => o.value);
    expect(options).not.toContain('sitting on');
  });

  it('a frame from the URL that does not exist falls back to the teaching frame', () => {
    at('?F6.img=no-such-frame');
    expect(screen.getByTestId('f6-status')).toHaveAttribute('data-recorded', 'false');
  });

  it('never says true, false, correct or wrong', () => {
    at('?F6.mp=1');
    const text = screen.getByTestId('f6-status').textContent?.toLowerCase() ?? '';
    expect(text).not.toMatch(/\b(true|false|correct|wrong)\b/);
  });

  it('shows no metric', () => {
    const { container } = at('?F6.mp=1');
    expect(container.textContent ?? '').not.toMatch(/\bmR\b|R@|recall/i);
  });
});
