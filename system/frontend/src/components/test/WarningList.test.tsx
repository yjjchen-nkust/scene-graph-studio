import { render, screen } from '@testing-library/react';
import type { Warning } from 'sgg-metrics';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/useLocale';
import { WarningList } from '../WarningList';

const WARNINGS: Warning[] = [
  {
    code: 'gt_boxes_not_pairs',
    message_en: 'PredCls and SGCls supply ground-truth boxes, not ground-truth pairs.',
    message_zh: 'PredCls 與 SGCls 提供的是 ground-truth boxes，不是 ground-truth pairs。',
  },
];

beforeEach(() => {
  setLocale('zh-TW');
});

describe('WarningList', () => {
  it('renders nothing when there is nothing to warn about', () => {
    const { container } = render(<WarningList warnings={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the engine wording verbatim, in the reader locale', () => {
    render(<WarningList warnings={WARNINGS} />);
    expect(screen.getByTestId('warning-gt_boxes_not_pairs')).toHaveTextContent(
      WARNINGS[0]!.message_zh,
    );
    setLocale('en');
    render(<WarningList warnings={WARNINGS} />);
    expect(screen.getAllByTestId('warning-gt_boxes_not_pairs')[0]).toHaveTextContent(
      WARNINGS[0]!.message_en,
    );
  });

  it('carries the code, so a quiz item can point at one', () => {
    render(<WarningList warnings={WARNINGS} />);
    expect(screen.getByTestId('warning-gt_boxes_not_pairs').getAttribute('data-code')).toBe(
      'gt_boxes_not_pairs',
    );
  });
});
