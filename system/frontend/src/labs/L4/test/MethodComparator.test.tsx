import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { ApiFailure } from '../../api';
import { GT, TWO_STAGE } from '../../L6/fixture';
import { MethodComparator } from '../MethodComparator';
import type { Column, ModelRow } from '../types';

beforeEach(() => {
  setLocale('en');
});

const BLOCKED: ModelRow = {
  id: 'psgformer', name: 'PSGFormer', family: 'panoptic', year: 2022, venue: 'ECCV',
  paper_key: 'psgformer-2022', live: false,
  live_blocked_reason_en: 'This model needs `detectron2`, which does not build here.',
  live_blocked_reason_zh: '本模型需要 `detectron2`，該套件無法於本環境建置。',
  estimated_seconds_per_image: null, predictions_available: [],
};

const LIVE: ModelRow = {
  ...BLOCKED, id: 'reltr', name: 'RelTR', family: 'one_stage', year: 2023, venue: 'TPAMI',
  paper_key: 'reltr-2023', live: true, live_blocked_reason_en: null, live_blocked_reason_zh: null,
  estimated_seconds_per_image: 4.2,
};

const RECONSTRUCTED: Column = {
  model: 'psgformer', graph: TWO_STAGE, fidelity: 'reconstructed',
  note: 'Reconstructed to reproduce the duplicate-mask behaviour; no checkpoint was run.',
};
const MEASURED: Column = { model: 'reltr', graph: TWO_STAGE, fidelity: 'measured', note: null };

function mount(over: Partial<Parameters<typeof MethodComparator>[0]> = {}) {
  const onInfer = vi.fn();
  const view = render(
    <MemoryRouter initialEntries={['/lab/L4']}>
      <MethodComparator
        gt={GT}
        columns={[MEASURED, RECONSTRUCTED]}
        models={[LIVE, BLOCKED]}
        onInfer={onInfer}
        {...over}
      />
    </MemoryRouter>,
  );
  return { ...view, onInfer };
}

describe('MethodComparator', () => {
  it('carries a provenance chip on every column', () => {
    mount();
    for (const model of ['reltr', 'psgformer']) {
      const column = screen.getByTestId(`column-${model}`);
      expect(within(column).getByTestId('provenance-chip')).toBeTruthy();
    }
  });

  it('makes a reconstructed column visually distinct from a measured one', () => {
    mount();
    const a = within(screen.getByTestId('column-reltr')).getByTestId('provenance-chip');
    const b = within(screen.getByTestId('column-psgformer')).getByTestId('provenance-chip');
    expect(a.getAttribute('data-fidelity')).toBe('measured');
    expect(b.getAttribute('data-fidelity')).toBe('reconstructed');
    expect(a.className).not.toBe(b.className);
  });

  it('puts a reconstructed note on the page, not behind a click', () => {
    mount();
    const note = within(screen.getByTestId('column-psgformer')).getByTestId('reconstructed-note');
    expect(note.textContent).toContain('no checkpoint was run');
    expect(note.closest('details')).toBeNull();
    expect(note.closest('[hidden]')).toBeNull();
  });

  it('disables live inference with the registry’s own reason, not a guess about torch', () => {
    // Plan 03 keys this on /api/health's torch_present. Liveness needs torch AND a checkpoint
    // (D37), so the registry's `live` flag and its stated reason are what the button follows.
    mount();
    const button = screen.getByTestId('infer-psgformer');
    expect(button).toBeDisabled();
    expect(screen.getByTestId('blocked-psgformer').textContent).toContain('detectron2');
  });

  it('says the demo is hosted, not that a package is missing, on a static deployment', () => {
    mount({ hosted: true });
    const reason = screen.getByTestId('blocked-psgformer').textContent ?? '';
    expect(reason).toContain('hosted demo');
    expect(reason).not.toContain('detectron2');
  });

  it('enables live inference only where the registry says it is live', () => {
    const { onInfer } = mount();
    const button = screen.getByTestId('infer-reltr');
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onInfer).toHaveBeenCalledWith('reltr');
  });

  it('shows the measured latency estimate before inference starts', () => {
    mount();
    expect(screen.getByTestId('latency-reltr').textContent).toContain('4.2');
  });

  it('says the estimate is unmeasured rather than printing a plausible one', () => {
    mount({ models: [{ ...LIVE, estimated_seconds_per_image: null }, BLOCKED] });
    const shown = screen.getByTestId('latency-reltr').textContent ?? '';
    expect(shown).toMatch(/not (been )?measured/i);
    expect(shown).not.toMatch(/\d+\.\d+\s*s/);
  });

  it('says there is nothing to compare rather than drawing an empty comparison', () => {
    mount({ columns: [] });
    expect(screen.getByTestId('no-columns')).toBeTruthy();
    expect(screen.queryByTestId('column-reltr')).toBeNull();
  });

  it('scores every column against the same ground truth and tags every figure', () => {
    mount();
    for (const model of ['reltr', 'psgformer']) {
      const readout = within(screen.getByTestId(`column-${model}`)).getByTestId('metrics');
      expect(readout.textContent).toContain('R@20');
      expect(readout.textContent).toContain('sgdet');
    }
  });

  /** The tier every figure in a column's readout carries, one entry per figure. */
  const tiers = (model: string) =>
    [
      ...within(screen.getByTestId(`column-${model}`))
        .getByTestId('metrics')
        .querySelectorAll('[data-fidelity]'),
    ].map((el) => el.getAttribute('data-fidelity'));

  it('tags a figure computed on a reconstructed prediction reconstructed, not measured', () => {
    // D-07: `measured` is reserved for a model's own output. The engine tags what it computes
    // `measured`, which is true of the computation and false of a recall over a hand-built graph.
    mount();
    expect(tiers('psgformer')).toEqual(['reconstructed', 'reconstructed']);
    expect(tiers('reltr')).toEqual(['measured', 'measured']);
  });

  it('takes the weaker tier when the ground truth is not measured either', () => {
    const gt = { ...GT, provenance: { kind: 'user', fidelity: 'reconstructed', note: 'Drawn.' } } as const;
    mount({ gt });
    expect(tiers('reltr')).toEqual(['reconstructed', 'reconstructed']);
  });

  it('says why a prediction could not be read, rather than counting it as none', () => {
    const error = new ApiFailure(500, 'internal_error', 'An unexpected error occurred.', '發生未預期的錯誤。');
    mount({ columns: [], failures: [{ model: 'psgformer', error }] });
    expect(screen.getByTestId('prediction-failed-psgformer')).toHaveTextContent('An unexpected error occurred.');
    expect(screen.getByTestId('prediction-failed-psgformer')).toHaveTextContent('PSGFormer');
    // "No predictions are committed" is a statement about the corpus, and nothing was learned
    // about the corpus: the read failed.
    expect(screen.queryByTestId('no-columns')).toBeNull();
  });

  it('shows the live run’s refusal under its button, with the reason the 503 gives', () => {
    const error = new ApiFailure(
      503,
      'inference_unavailable',
      'Live inference is not available for this model on this machine.',
      '此機器無法對本模型執行即時推論。',
      {
        model: 'reltr',
        reason_en: 'No RelTR checkpoint is present under data/checkpoints/reltr/.',
        reason_zh: 'data/checkpoints/reltr/ 下沒有 RelTR 檢查點。',
        torch_present: true,
        checkpoint_present: false,
      },
    );
    mount({ refusal: { model: 'reltr', error } });
    const shown = within(screen.getByTestId('column-reltr')).getByTestId('refused-reltr');
    expect(shown).toHaveTextContent('Live inference is not available');
    expect(shown).toHaveTextContent('No RelTR checkpoint is present');
    expect(screen.queryByTestId('refused-psgformer')).toBeNull();
  });

  it('gives the refusal’s reason in the locale on screen', () => {
    setLocale('zh-TW');
    const error = new ApiFailure(503, 'inference_unavailable', 'Not here.', '此機器無法對本模型執行即時推論。', {
      reason_en: 'No checkpoint.',
      reason_zh: '沒有檢查點。',
    });
    mount({ refusal: { model: 'reltr', error } });
    const shown = screen.getByTestId('refused-reltr');
    expect(shown).toHaveTextContent('沒有檢查點。');
    expect(shown).not.toHaveTextContent('No checkpoint.');
  });
});
