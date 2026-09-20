import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Choice, PlaygroundFrame, Readout, Slider, Toggle } from '../controls';

describe('the control kit is made of real form controls', () => {
  it('Toggle is a checkbox with a label that focuses it', () => {
    const onChange = vi.fn();
    render(<Toggle id="boxes" label="Boxes" checked={false} onChange={onChange} />);
    const box = screen.getByLabelText('Boxes');
    expect(box.tagName).toBe('INPUT');
    expect(box).toHaveAttribute('type', 'checkbox');
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Slider is a range input, so a focused slider keeps its arrow keys', () => {
    // `isTextEntry` in useStepper returns true for INPUT of every type, which is what stops the
    // deck from stealing the arrows while the professor is dragging this.
    const onChange = vi.fn();
    render(
      <Slider id="density" label="Density" value={0.5} min={0} max={1} step={0.1}
              onChange={onChange} valueLabel="50%" />,
    );
    const slider = screen.getByLabelText('Density');
    expect(slider).toHaveAttribute('type', 'range');
    fireEvent.change(slider, { target: { value: '0.8' } });
    expect(onChange).toHaveBeenCalledWith(0.8);
  });

  it('Choice is a select', () => {
    const onChange = vi.fn();
    render(
      <Choice id="P" label="|P|" value="16"
              options={[{ value: '16', label: '16' }, { value: '50', label: '50' }]}
              onChange={onChange} />,
    );
    const select = screen.getByLabelText('|P|');
    expect(select.tagName).toBe('SELECT');
    fireEvent.change(select, { target: { value: '50' } });
    expect(onChange).toHaveBeenCalledWith('50');
  });

  it('Readout shows a number beside where it came from', () => {
    render(<Readout id="F1.candidates" label="Candidates" value="480" note="6 x 5 x 16" />);
    expect(screen.getByTestId('readout-F1.candidates')).toHaveTextContent('480');
    expect(screen.getByTestId('readout-F1.candidates')).toHaveTextContent('6 x 5 x 16');
  });

  it('Readout keys its test id on the id, not on the label the locale changes', () => {
    // The test id was `readout-${label}`, so `readout-Candidate triplets` existed under `en`
    // and nothing equivalent existed under `zh-TW`. Every browser assertion that addressed a
    // readout was therefore a test of the English build, passing only because the describe
    // block around it forced the locale.
    const { rerender } = render(<Readout id="F1.candidates" label="Candidates" value="480" note="n" />);
    expect(screen.getByTestId('readout-F1.candidates')).toBeInTheDocument();
    rerender(<Readout id="F1.candidates" label="候選三元組數" value="480" note="n" />);
    expect(screen.getByTestId('readout-F1.candidates')).toHaveTextContent('候選三元組數');
  });

  it('PlaygroundFrame puts the controls before the visual in document order', () => {
    render(
      <PlaygroundFrame title="F1" controls={<button type="button">knob</button>}>
        <p>visual</p>
      </PlaygroundFrame>,
    );
    const root = screen.getByTestId('playground-frame');
    const controls = screen.getByTestId('playground-controls');
    const visual = screen.getByTestId('playground-visual');
    expect(root).toContainElement(controls);
    expect(controls.compareDocumentPosition(visual) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('nothing in the kit takes focus on mount', () => {
    render(
      <PlaygroundFrame title="F1" controls={<Toggle id="b" label="Boxes" checked onChange={() => {}} />}>
        <p>visual</p>
      </PlaygroundFrame>,
    );
    expect(document.activeElement).toBe(document.body);
  });
});
