import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { SplitReleases } from '../SplitReleases';

beforeEach(() => setLocale('en'));

function at(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/m/m01${search}`]}>
      <SplitReleases />
    </MemoryRouter>,
  );
}

describe('X1', () => {
  it('opens on the project\'s own release against the canonical protocol', () => {
    at();
    expect(screen.getByTestId('x1-train-a')).toHaveTextContent('68,538');
    expect(screen.getByTestId('x1-train-b')).toHaveTextContent('57,723');
    expect(screen.getByTestId('x1-train-diff')).toHaveTextContent('10,815');
  });

  it('names the sentence of the sources each difference equals', () => {
    at();
    const train = screen.getByTestId('x1-equality-train');
    expect(train).toHaveAttribute('data-explained', 'true');
    expect(train).toHaveTextContent('68,538 − 57,723 = 10,815');
    expect(train).toHaveTextContent("v2's training images with no relation, kept");
    expect(screen.getByTestId('x1-equality-test')).toHaveTextContent("v2's test images with no relation, kept");
  });

  it('v1 against v2: five thousand into train, 4,844 out of test', () => {
    at('?X1.r=sgb-v1&X1.vs=sgb-v2');
    expect(screen.getByTestId('x1-equality-train')).toHaveTextContent('the canonical validation set, folded into v1\'s train');
    expect(screen.getByTestId('x1-test-diff')).toHaveTextContent('−4,844');
    expect(screen.getByTestId('x1-equality-test')).toHaveTextContent('drawn from the test pool');
    expect(screen.getByTestId('x1-disjoint-a')).toHaveTextContent('validation drawn from the test pool');
  });

  it('a difference no sentence states is reported as such, not explained', () => {
    at('?X1.r=sgb-v1&X1.vs=canonical');
    expect(screen.getByTestId('x1-equality-test')).toHaveAttribute('data-explained', 'false');
    expect(screen.getByTestId('x1-equality-test')).toHaveTextContent('No sentence of the sources states this difference.');
  });

  it('Xu states shares, not counts, and the playground never multiplies them out', () => {
    const { container } = at('?X1.r=xu-2017&X1.vs=canonical');
    expect(screen.getByTestId('x1-train-a')).toHaveTextContent('70%');
    expect(screen.getByTestId('x1-val-a')).toHaveTextContent('not stated by the source');
    expect(screen.getByTestId('x1-train-diff')).toHaveTextContent('not both stated as counts');
    expect(screen.queryByTestId('x1-equality-train')).toBeNull();
    expect(screen.getByTestId('x1-row-pool')).toHaveTextContent('108,077');
    expect(container.textContent ?? '').not.toMatch(/75,6\d\d/);
  });

  it('an unknown release in the URL falls back to the default', () => {
    at('?X1.r=vg150');
    expect(screen.getByTestId('x1-train-a')).toHaveTextContent('68,538');
  });

  it('a release compared with itself differs by nothing and claims no explanation', () => {
    at('?X1.r=canonical&X1.vs=canonical');
    expect(screen.getByTestId('x1-train-diff')).toHaveTextContent(/^0/);
    expect(screen.queryByTestId('x1-equality-train')).toBeNull();
  });

  it('every figure shown carries a numbered source', () => {
    at();
    for (const cell of ['x1-train-a', 'x1-train-b', 'x1-val-a', 'x1-test-b']) {
      expect(screen.getByTestId(cell).querySelector('sup')?.textContent, cell).toMatch(/^\d+$/);
    }
    expect(screen.getByTestId('x1-sources')).toHaveTextContent('vg150-sgb card, Dataset statistics');
  });

  it('labels follow the locale', () => {
    setLocale('zh-TW');
    at();
    expect(screen.getByTestId('X1.r')).toHaveTextContent('SGG-Benchmark 發布版本 v2');
  });
});
