import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Readout } from '../../playgrounds/controls';
import { DemoFrame } from '../DemoFrame';

function draw() {
  return render(
    <DemoFrame
      title="D-T"
      controls={<Readout id="DT.objects" label="Objects" value="6" note="n" />}
      provenance="fasterrcnn-r50fpn-coco+freq-vg150sgb · 2026-09-29 · measured"
    >
      <p data-testid="body">the part</p>
    </DemoFrame>,
  );
}

describe('DemoFrame', () => {
  it('holds the controls, then the visual, then the provenance line', () => {
    draw();
    const frame = screen.getByTestId('demo-frame');
    expect(frame).toHaveAttribute('aria-label', 'D-T');
    const parts = ['demo-controls', 'demo-visual', 'demo-provenance'].map((id) => within(frame).getByTestId(id));
    expect(parts[0]!.compareDocumentPosition(parts[1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(parts[1]!.compareDocumentPosition(parts[2]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(parts[1]!).getByTestId('body')).toBeInTheDocument();
    expect(parts[2]).toHaveTextContent('fasterrcnn-r50fpn-coco+freq-vg150sgb · 2026-09-29 · measured');
  });

  it('never clips the visual, since a demo is words and figures beside its pictures', () => {
    draw();
    const visual = screen.getByTestId('demo-visual');
    expect(visual.className).not.toMatch(/overflow-hidden|max-h-/);
  });

  it('uses the dense spacing, and its readouts read it', () => {
    draw();
    expect(screen.getByTestId('demo-frame').className).toBe('my-1 rounded-lg border border-slate-200 bg-slate-50 p-2');
    expect(screen.getByTestId('readout-DT.objects-value').className).toContain('leading-none');
  });
});
