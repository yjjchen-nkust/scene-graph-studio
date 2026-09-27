import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { MatchRelation } from '../MatchRelation';

beforeEach(() => setLocale('en'));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <MatchRelation />
    </MemoryRouter>,
  );

const ROWS = ['e1-c-cs', 'e1-c-co', 'e1-c-p', 'e1-c-is', 'e1-c-io'];
const holding = () => ROWS.filter((id) => screen.getByTestId(id).getAttribute('data-holds') === 'true');

describe('E1', () => {
  it('opens on the annotation itself: every conjunct holds and the diff says match', () => {
    renderAt('/m/m03');
    expect(holding()).toEqual(ROWS);
    expect(screen.getByTestId('e1-relation')).toHaveTextContent('holds');
    expect(screen.getByTestId('e1-mode')).toHaveTextContent('No failure');
    expect(screen.getByTestId('e1-verdict')).toHaveTextContent('The diff: match; t matched');
  });

  it('each toggle falsifies its own row only', () => {
    const pairs = [['E1.cs', 'e1-c-cs'], ['E1.co', 'e1-c-co'], ['E1.p', 'e1-c-p'], ['E1.bs', 'e1-c-is'], ['E1.bo', 'e1-c-io']];
    for (const [knob, row] of pairs) {
      const view = renderAt('/m/m03');
      fireEvent.click(screen.getByTestId(knob!));
      expect(ROWS.filter((id) => !holding().includes(id)), knob).toEqual([row]);
      view.unmount();
    }
  });

  it('a wrong name is spurious wherever its box sits', () => {
    renderAt('/m/m03?E1.p=1&E1.bs=1');
    expect(screen.getByTestId('e1-mode')).toHaveTextContent('Both halves wrong');
    expect(screen.getByTestId('e1-verdict')).toHaveTextContent('The diff: spurious; t missed');
  });

  it('a right name in the wrong place is localization', () => {
    renderAt('/m/m03?E1.bs=1&E1.bo=1');
    expect(screen.getByTestId('e1-mode')).toHaveTextContent('Right name, wrong place');
    expect(screen.getByTestId('e1-verdict')).toHaveTextContent('The diff: localization; t missed');
  });

  it('every toggle on: all five rows fail, the relation fails, the diff says spurious', () => {
    renderAt('/m/m03?E1.cs=1&E1.co=1&E1.p=1&E1.bs=1&E1.bo=1');
    expect(holding()).toEqual([]);
    expect(screen.getByTestId('e1-relation')).toHaveTextContent('fails');
    expect(screen.getByTestId('e1-mode')).toHaveTextContent('Both halves wrong');
    expect(screen.getByTestId('e1-verdict')).toHaveTextContent('spurious');
  });

  it('a malformed toggle in the URL is off', () => {
    renderAt('/m/m03?E1.cs=abc');
    expect(screen.getByTestId('e1-c-cs')).toHaveAttribute('data-holds', 'true');
  });

  it('shows each IoU as its two counts', () => {
    renderAt('/m/m03?E1.bs=1');
    expect(screen.getByTestId('e1-c-is')).toHaveTextContent('3,150 / 9,450');
    expect(screen.getByTestId('e1-c-io')).toHaveTextContent('46,200 / 46,200');
  });

  it('draws the annotation solid and the prediction dashed', () => {
    renderAt('/m/m03?E1.bs=1');
    expect(screen.getByTestId('e1-gt-s').getAttribute('stroke-dasharray')).toBeNull();
    expect(screen.getByTestId('e1-pred-s').getAttribute('stroke-dasharray')).toBeTruthy();
    expect(screen.getByTestId('e1-pred-s').getAttribute('x')).toBe('295');
  });

  it("writes the conjuncts and the halves in s2's notation, with subscripts", () => {
    renderAt('/m/m03');
    expect(screen.getByTestId('e1-c-cs').querySelector('sub')).not.toBeNull();
    expect(screen.getByTestId('e1-phi-cls').querySelector('sub')?.textContent).toBe('cls');
    expect(screen.getByTestId('e1-phi-cls').textContent).not.toContain('_');
  });

  it('reads in 繁體中文', () => {
    setLocale('zh-TW');
    renderAt('/m/m03?E1.bs=1');
    expect(screen.getByTestId('e1-mode')).toHaveTextContent('名稱正確、位置錯誤');
    expect(screen.getByTestId('e1-verdict')).toHaveTextContent('差異圖：localization；t 為 missed');
  });

  it('takes no focus on mount', () => {
    renderAt('/m/m03');
    expect(document.activeElement).toBe(document.body);
  });
});
