import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import en from '../../../i18n/en.json';
import { setLocale } from '../../../i18n/useLocale';
import zh from '../../../i18n/zh-TW.json';
import { frameById } from '../../slice';
import { ProtocolSpaces } from '../ProtocolSpaces';
import { E10_FRAME } from '../setup';

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
  it('names its frame from E10_FRAME, not from a literal in the string (D102)', () => {
    renderAt('/m/m03');
    expect(screen.getByTestId('e10-picture').querySelector('img'))
      .toHaveAttribute('alt', `Frame ${E10_FRAME}, as the chosen protocol hands it over`);
    cleanup();
    setLocale('zh-TW');
    renderAt('/m/m03');
    expect(screen.getByTestId('e10-picture').querySelector('img')).toHaveAttribute('alt', `影格 ${E10_FRAME}，依所選協定提供之內容`);
    for (const strings of [en, zh]) expect(strings['playground.e10.picture']).not.toContain(E10_FRAME);
  });

  it('opens on PredCls over this slice: six boxes, six labels, 480', () => {
    renderAt('/m/m03');
    expect(boxes()).toHaveLength(6);
    expect(screen.getByTestId('e10-given')).toHaveTextContent('#1 table, #2 person, #3 box, #4 glove, #5 wrench, #6 panel');
    expect(screen.getByTestId('e10-badge-1')).toHaveTextContent('#1');
    expect(screen.getByTestId('e10-row-predcls')).toHaveTextContent('480');
    expect(chosen()).toEqual(['predcls']);
  });

  it('SGCls keeps the boxes and withholds the labels', () => {
    renderAt('/m/m03?E10.pr=sgcls');
    expect(boxes()).toHaveLength(6);
    expect(screen.getByTestId('e10-given')).toHaveTextContent('boxes #1 to #6; no labels');
    expect(screen.getByTestId('e10-given')).not.toHaveTextContent('glove');
    expect(screen.getByTestId('e10-badge-6')).toHaveTextContent('#6');
    expect(screen.getByTestId('e10-row-sgcls')).toHaveTextContent('48,000');
  });

  it('SGDet hands over nothing and still shows all three counts', () => {
    renderAt('/m/m03?E10.pr=sgdet');
    expect(boxes()).toHaveLength(0);
    expect(screen.queryByTestId('e10-badge-1')).toBeNull();
    expect(screen.getByTestId('e10-given')).toHaveTextContent('no boxes, no labels');
    // |V| is not handed over under SGDet, so it is not printed.
    expect(screen.getByTestId('e10-vocabulary')).not.toHaveTextContent('|V|');
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
    expect(screen.getByTestId('e10-inclusion')).toHaveTextContent('ℋPredCls ⊆ ℋSGCls ⊆ ℋSGDet');
    expect(screen.getByTestId('e10-inclusion').querySelectorAll('sub')).toHaveLength(3);
  });

  it('states when the inclusion holds', () => {
    renderAt('/m/m03?E10.voc=vg150');
    expect(screen.getByTestId('e10-inclusion-if')).toHaveTextContent('the given labels are in 𝒞');
  });

  it('marks the chosen row with a sign, not colour alone', () => {
    renderAt('/m/m03?E10.pr=sgcls');
    const marks = screen.getAllByTestId('e10-chosen');
    expect(marks).toHaveLength(1);
    // U+25BA has no emoji presentation; U+25B6 is drawn as a coloured emoji on Windows.
    expect(marks[0]).toHaveTextContent('►');
    expect(screen.getByTestId('e10-row-sgcls')).toContainElement(marks[0]!);
    // Every row holds the sign's place, and only the chosen row shows it (D102).
    const signs = ['predcls', 'sgcls', 'sgdet'].map((p) => screen.getByTestId(`e10-row-${p}`).querySelector('th > span'));
    expect(signs.map((s) => s?.textContent)).toEqual(['► ', '► ', '► ']);
    expect(signs.map((s) => s?.classList.contains('invisible'))).toEqual([true, false, true]);
  });

  it('builds the boxes note from its frame and prints B', () => {
    renderAt('/m/m03?E10.pr=sgdet');
    const f = frameById(E10_FRAME)!;
    // C(641, 2) = 205,120 and C(481, 2) = 115,440, whose product is B.
    expect(screen.getByTestId('e10-boxes-note')).toHaveTextContent(
      `B = C(${f.width + 1}, 2) · C(${f.height + 1}, 2) = 23,679,052,800 whole-pixel boxes`);
    for (const table of [en, zh]) expect(table['playground.e10.boxes_note']).not.toMatch(/\d{3}/);
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
