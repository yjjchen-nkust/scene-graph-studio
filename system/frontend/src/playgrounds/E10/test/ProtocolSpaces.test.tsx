import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { ProtocolSpaces } from '../ProtocolSpaces';

beforeEach(() => setLocale('en'));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ProtocolSpaces />
    </MemoryRouter>,
  );

const boxes = () => screen.getByTestId('e10-picture').querySelectorAll('rect[data-testid^="e10-box-"]:not([data-testid$="-halo"])');
const chosen = () =>
  ['predcls', 'sgcls', 'sgdet'].filter((p) => screen.getByTestId(`e10-row-${p}`).getAttribute('aria-current') === 'true');

describe('E10', () => {
  it('opens on PredCls over this slice: six boxes, six labels, 480', () => {
    renderAt('/m/m03');
    expect(boxes()).toHaveLength(6);
    expect(screen.getByTestId('e10-given')).toHaveTextContent('table, person, box, glove, wrench, panel');
    expect(screen.getByTestId('e10-row-predcls')).toHaveTextContent('480');
    expect(chosen()).toEqual(['predcls']);
  });

  it('SGCls keeps the boxes and withholds the labels', () => {
    renderAt('/m/m03?E10.pr=sgcls');
    expect(boxes()).toHaveLength(6);
    expect(screen.getByTestId('e10-given')).toHaveTextContent('no labels');
    expect(screen.getByTestId('e10-given')).not.toHaveTextContent('glove');
    expect(screen.getByTestId('e10-row-sgcls')).toHaveTextContent('48,000');
  });

  it('SGDet hands over nothing and still shows all three counts', () => {
    renderAt('/m/m03?E10.pr=sgdet');
    expect(boxes()).toHaveLength(0);
    expect(screen.getByTestId('e10-given')).toHaveTextContent('no boxes, no labels');
    expect(screen.getByTestId('e10-row-predcls')).toHaveTextContent('480');
    expect(screen.getByTestId('e10-row-sgcls')).toHaveTextContent('48,000');
    expect(screen.getByTestId('e10-row-sgdet')).toHaveTextContent('897,116,066,370,414,059,520,000');
    expect(chosen()).toEqual(['sgdet']);
  });

  it('prints the SGDet count digit for digit', () => {
    renderAt('/m/m03?E10.pr=sgdet&E10.voc=vg150');
    expect(screen.getByTestId('e10-row-sgdet')).toHaveTextContent('630,784,734,166,697,385,600,000,000');
    expect(screen.getByTestId('e10-row-sgdet').textContent).not.toMatch(/e\+|×\s?10/);
    expect(screen.getByTestId('e10-row-predcls')).toHaveTextContent('1,500');
    expect(screen.getByTestId('e10-row-sgcls')).toHaveTextContent('33,750,000');
  });

  it('falls back on malformed knobs', () => {
    renderAt('/m/m03?E10.pr=foo&E10.voc=bar');
    expect(chosen()).toEqual(['predcls']);
    expect(screen.getByTestId('e10-row-predcls')).toHaveTextContent('480');
  });

  it('states the inclusion between the three', () => {
    renderAt('/m/m03');
    expect(screen.getByTestId('e10-inclusion')).toHaveTextContent('ℋ_PredCls ⊆ ℋ_SGCls ⊆ ℋ_SGDet');
  });

  it('reads in 繁體中文', () => {
    setLocale('zh-TW');
    renderAt('/m/m03?E10.pr=sgdet');
    expect(screen.getByTestId('e10-given')).toHaveTextContent('無框、無標籤');
  });

  it('takes no focus on mount', () => {
    renderAt('/m/m03');
    expect(document.activeElement).toBe(document.body);
  });
});
