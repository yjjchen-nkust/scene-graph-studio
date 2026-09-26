import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('counts distinct triplets: on alone holds 248, not its 382 annotation rows', () => {
    at();
    expect(value('F6.group')).toHaveTextContent(/^248$/);
    expect(screen.getByTestId('readout-F6.group')).toHaveTextContent('on 248');
  });

  it('writes the merged class out as its members, less the pairs that carried two of them', () => {
    at('?F6.mp=1');
    expect(value('F6.group')).toHaveTextContent(/^272$/);
    expect(screen.getByTestId('readout-F6.group')).toHaveTextContent(
      'on 248 + above 11 + over 5 + sitting on 10 − 2 = 272',
    );
  });

  it('says in words what the subtraction is, and only when there is one', () => {
    at('?F6.mp=1');
    expect(screen.getByTestId('f6-collapsed')).toHaveTextContent(
      /^2 pairs carry two members of the group; E′ records each pair once.$/,
    );
    cleanup();
    at('?F6.mo=1');
    expect(screen.queryByTestId('f6-collapsed')).toBeNull();
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
    expect(screen.getByTestId('F6.img')).toHaveValue('1039');
    expect(screen.getByTestId('f6-annotated')).toHaveTextContent('light above woman');
    expect(screen.getByTestId('f6-status')).toHaveAttribute('data-recorded', 'false');
  });

  it('a frame that exists but carries no group edge also falls back to the teaching frame', () => {
    // Frame 1139 is in the slice and has no edge from the merge group, so it offers nothing to
    // substitute into; the panel must not blank on it.
    at('?F6.img=1139');
    expect(screen.getByTestId('F6.img')).toHaveValue('1039');
    expect(screen.getByTestId('f6-annotated')).toHaveTextContent('light above woman');
  });

  it('every edge option can be told apart, even where a frame repeats a sentence', () => {
    // Frame 2008 carries "pillow on bed" five times, between different pillows and beds.
    at('?F6.img=2008');
    const labels = [...screen.getByTestId('F6.rel').querySelectorAll('option')].map((o) => o.textContent);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain('pillow #27 sitting on bed #1');
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

  it('reads in 繁體中文 with the same numbers', () => {
    setLocale('zh-TW');
    at('?F6.mp=1');
    expect(screen.getByTestId('readout-F6.predicates')).toHaveTextContent('使用中之 predicate 類別數');
    expect(value('F6.predicates')).toHaveTextContent(/^33$/);
    expect(screen.getByTestId('f6-status')).toHaveTextContent('此邊收錄於 E′');
    // A full-width colon with no space after it, as X1's (D94).
    expect(screen.getByTestId('f6-annotated')).toHaveTextContent(/^標註：light above woman$/);
  });

  it('does not take focus when it mounts', () => {
    at();
    expect(document.activeElement).toBe(document.body);
  });
});
