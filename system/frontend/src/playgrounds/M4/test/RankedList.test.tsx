import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { capPerPair } from '../../logic';
import { PairPhoto } from '../PairPhoto';
import { M4_RANKING } from '../ranking';
import { RankedList } from '../RankedList';

beforeEach(() => setLocale('en'));

// Under cap 1 the kept ranks are 1, 3, 4, 5, 8, 11, 12 (task 2's own arithmetic; a test that
// disagrees with `capPerPair` is the defect, not this list).
const KEPT_CAP1 = capPerPair(M4_RANKING, 1);
const KEPT_RANKS_CAP1 = [1, 3, 4, 5, 8, 11, 12];
const DROPPED_RANKS_CAP1 = [2, 6, 7, 9, 10];

describe('RankedList', () => {
  it('draws twelve rows in rank order', () => {
    render(<RankedList rows={M4_RANKING} kept={KEPT_CAP1} k={7} chosen={1} matched={new Set()} testid="list" />);
    const ranks = M4_RANKING.map((row) => screen.getByTestId(`list-row-${row.rank}`));
    for (let i = 1; i < ranks.length; i += 1) {
      expect(ranks[i - 1]!.compareDocumentPosition(ranks[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(ranks).toHaveLength(12);
  });

  it('puts the cut after the k-th kept row', () => {
    render(<RankedList rows={M4_RANKING} kept={KEPT_CAP1} k={2} chosen={1} matched={new Set()} testid="list" />);
    const row3 = screen.getByTestId('list-row-3');
    const cut = screen.getByTestId('list-cut');
    expect(row3.nextElementSibling).toBe(cut);
    expect(cut).toHaveTextContent('top 2');
    expect(screen.getByTestId('list-row-1')).toHaveAttribute('data-top', 'true');
    expect(screen.getByTestId('list-row-3')).toHaveAttribute('data-top', 'true');
    expect(screen.getByTestId('list-row-2')).toHaveAttribute('data-kept', 'false');
    expect(screen.getByTestId('list-row-2')).toHaveClass('line-through');
    expect(screen.getByTestId('list-row-1')).not.toHaveClass('line-through');
  });

  it('puts the cut after the last kept row when k passes the pool', () => {
    render(<RankedList rows={M4_RANKING} kept={KEPT_CAP1} k={12} chosen={1} matched={new Set()} testid="list" />);
    const row12 = screen.getByTestId('list-row-12');
    const cut = screen.getByTestId('list-cut');
    expect(row12.nextElementSibling).toBe(cut);
    expect(cut).toHaveTextContent('top 12');
    expect(screen.getByTestId('list-row-12')).toHaveAttribute('data-kept', 'true');
    for (const rank of KEPT_RANKS_CAP1) {
      expect(screen.getByTestId(`list-row-${rank}`)).toHaveAttribute('data-top', 'true');
    }
    for (const rank of DROPPED_RANKS_CAP1) {
      expect(screen.getByTestId(`list-row-${rank}`)).toHaveAttribute('data-top', 'false');
    }
  });

  it('marks a matched row by a sign, not by colour alone', () => {
    render(
      <RankedList rows={M4_RANKING} kept={KEPT_CAP1} k={1} chosen={1} matched={new Set([1])} testid="list" />,
    );
    // Every row holds a ✓ so that no row's width moves with the match; a text match would pass for
    // every row. What differs is whether the sign is shown.
    const sign = (rank: number) =>
      [...screen.getByTestId(`list-row-${rank}`).querySelectorAll('span')].find((s) => s.textContent === '✓')!;
    const row1 = screen.getByTestId('list-row-1');
    expect(row1).toHaveAttribute('data-matched', 'true');
    expect(sign(1)).not.toHaveClass('invisible');
    const row3 = screen.getByTestId('list-row-3');
    expect(row3).toHaveAttribute('data-kept', 'true');
    expect(row3).toHaveAttribute('data-matched', 'false');
    expect(sign(3)).toHaveClass('invisible');
  });

  it('does not mark a matched row that the cap dropped or the cut excluded', () => {
    // rank 2 is in `matched` but the cap drops it, and rank 3 is in `matched` but k = 1 cuts it.
    render(
      <RankedList rows={M4_RANKING} kept={KEPT_CAP1} k={1} chosen={1} matched={new Set([2, 3])} testid="list" />,
    );
    expect(screen.getByTestId('list-row-2')).toHaveAttribute('data-matched', 'false');
    expect(screen.getByTestId('list-row-3')).toHaveAttribute('data-matched', 'false');
  });

  it('outlines the chosen row, even a dropped one', () => {
    render(<RankedList rows={M4_RANKING} kept={KEPT_CAP1} k={1} chosen={2} matched={new Set()} testid="list" />);
    const row2 = screen.getByTestId('list-row-2');
    expect(row2).toHaveAttribute('aria-current', 'true');
    expect(row2).toHaveAttribute('data-kept', 'false');
    expect(screen.getByTestId('list-row-1')).not.toHaveAttribute('aria-current');
  });

  it('states the legend in words, never in colour alone', () => {
    render(<RankedList rows={M4_RANKING} kept={KEPT_CAP1} k={1} chosen={1} matched={new Set()} testid="list" />);
    expect(screen.getByTestId('list-legend')).toHaveTextContent(
      'Struck through: dropped by the constraint. ✓: a ground truth matched in the top k.',
    );
  });

  it('captions the table from the copy table', () => {
    render(<RankedList rows={M4_RANKING} kept={KEPT_CAP1} k={1} chosen={1} matched={new Set()} testid="list" />);
    expect(screen.getByTestId('list-table')).toHaveTextContent('The ranked list on ph-001, PredCls, scores descending');
  });

  it("PairPhoto draws the chosen row's two boxes", () => {
    render(<PairPhoto row={M4_RANKING[0]!} testid="photo" />);
    expect(screen.getByTestId('photo-s')).toBeInTheDocument();
    expect(screen.getByTestId('photo-o')).toBeInTheDocument();
    expect(screen.getByTestId('photo-badge-s')).toHaveTextContent('#2');
    expect(screen.getByTestId('photo-badge-o')).toHaveTextContent('#5');
    const img = screen.getByTestId('photo').querySelector('img')!;
    expect(img).toHaveAttribute('alt', 'Row 1 on ph-001, its subject and object');
  });

  it('reads in 繁體中文', () => {
    setLocale('zh-TW');
    render(<RankedList rows={M4_RANKING} kept={KEPT_CAP1} k={2} chosen={1} matched={new Set()} testid="list" />);
    expect(screen.getByTestId('list-table')).toHaveTextContent('ph-001 之排序清單（PredCls，依分數遞減）');
    expect(screen.getByTestId('list-cut')).toHaveTextContent('前 2 名');
    expect(screen.getByTestId('list-legend')).toHaveTextContent(
      '刪除線：遭約束排除。✓：前 k 名中命中之標準答案。',
    );
    render(<PairPhoto row={M4_RANKING[0]!} testid="photo-zh" />);
    expect(screen.getByTestId('photo-zh').querySelector('img')).toHaveAttribute(
      'alt',
      'ph-001 第 1 列之主詞與受詞',
    );
  });
});
