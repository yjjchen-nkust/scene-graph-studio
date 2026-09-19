import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { SceneGraph } from 'sgg-metrics';
import { describe, expect, it } from 'vitest';
import { MiniISGAnnotator } from '../MiniISGAnnotator';

const OBJECTS = [
  { object_id: 1, names: ['hand'], bbox: { x: 230, y: 265, w: 350, h: 260 } },
  { object_id: 2, names: ['beam'], bbox: { x: 370, y: 440, w: 300, h: 130 } },
  { object_id: 3, names: ['assembly'], bbox: { x: 370, y: 325, w: 640, h: 395 } },
  { object_id: 4, names: ['workbench'], bbox: { x: 0, y: 0, w: 1280, h: 720 } },
];

const DRAFT: SceneGraph = {
  image_id: 'isg-016',
  dataset: 'mini-isg',
  width: 1280,
  height: 720,
  objects: OBJECTS,
  relationships: [
    { relationship_id: 1, subject_id: 1, predicate: 'holding', object_id: 2 },
    { relationship_id: 2, subject_id: 1, predicate: 'tightening', object_id: 3 },
  ],
  provenance: { kind: 'vlm', fidelity: 'reconstructed', note: 'drafted by a model' },
};

const REFERENCE: SceneGraph = {
  ...DRAFT,
  relationships: [
    { relationship_id: 1, subject_id: 1, predicate: 'holding', object_id: 2 },
    { relationship_id: 2, subject_id: 1, predicate: 'assembling', object_id: 3 },
    { relationship_id: 3, subject_id: 2, predicate: 'attached to', object_id: 3 },
    { relationship_id: 4, subject_id: 3, predicate: 'on', object_id: 4 },
  ],
  provenance: { kind: 'user', fidelity: 'measured', note: 'hand-corrected reference' },
};

const P = ['holding', 'assembling', 'attached to', 'inserted into', 'on', 'near', 'reaching for'];

function mount(props: Partial<Parameters<typeof MiniISGAnnotator>[0]> = {}) {
  return render(
    <MemoryRouter>
      <MiniISGAnnotator
        draft={DRAFT}
        reference={REFERENCE}
        imageUrl="data:image/jpeg;base64,x"
        predicates={P}
        {...props}
      />
    </MemoryRouter>,
  );
}

const counter = () => screen.getByTestId('correction-count');

describe('MiniISGAnnotator', () => {
  it('shows the draft triplets it was given', () => {
    mount();
    const rows = screen.getAllByTestId(/^triplet-/);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('hand');
    expect(rows[0]).toHaveTextContent('holding');
    expect(rows[0]).toHaveTextContent('beam');
  });

  it('starts the count at zero', () => {
    mount();
    expect(counter()).toHaveTextContent('0');
  });

  it('counts a deletion and drops the triplet', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(within(screen.getByTestId('triplet-1')).getByTestId('delete'));
    expect(screen.getAllByTestId(/^triplet-/)).toHaveLength(1);
    expect(screen.getByTestId('count-deletions')).toHaveTextContent('1');
    expect(counter()).toHaveTextContent('1');
  });

  it('counts a predicate rewrite once, and only when the value changes', async () => {
    const user = userEvent.setup();
    mount();
    const select = within(screen.getByTestId('triplet-2')).getByRole('combobox');
    await user.selectOptions(select, 'assembling');
    expect(screen.getByTestId('count-predicates')).toHaveTextContent('1');
    await user.selectOptions(select, 'assembling');
    expect(screen.getByTestId('count-predicates')).toHaveTextContent('1');
  });

  it('offers only predicates from the dictionary, so a rewrite cannot leave it', async () => {
    mount();
    const select = within(screen.getByTestId('triplet-2')).getByRole('combobox');
    const options = within(select).getAllByRole('option').map((o) => o.textContent);
    // The draft's own out-of-vocabulary predicate is there, marked, because a select that did
    // not carry it would silently change the triplet the moment the page rendered.
    expect(options).toContain('tightening');
    for (const p of P) expect(options).toContain(p);
  });

  it('marks the draft predicate that is outside the dictionary', () => {
    mount();
    expect(within(screen.getByTestId('triplet-2')).getByTestId('oov')).toBeInTheDocument();
    expect(within(screen.getByTestId('triplet-1')).queryByTestId('oov')).toBeNull();
  });

  it('counts an addition and puts the triplet in the list', async () => {
    const user = userEvent.setup();
    mount();
    await user.selectOptions(screen.getByTestId('add-subject'), '2');
    await user.selectOptions(screen.getByTestId('add-predicate'), 'attached to');
    await user.selectOptions(screen.getByTestId('add-object'), '3');
    await user.click(screen.getByTestId('add-triplet'));
    expect(screen.getAllByTestId(/^triplet-/)).toHaveLength(3);
    expect(screen.getByTestId('count-additions')).toHaveTextContent('1');
  });

  it('keeps the draft on screen beside the corrections', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(within(screen.getByTestId('triplet-1')).getByTestId('delete'));
    // The "before" is half of what the lab is showing. Deleting from the working copy must not
    // delete it from the draft panel.
    expect(within(screen.getByTestId('draft-panel')).getAllByRole('listitem')).toHaveLength(2);
  });

  it('projects the count to the authors’ scale and says it is arithmetic', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(within(screen.getByTestId('triplet-1')).getByTestId('delete'));
    const projection = screen.getByTestId('projection');
    expect(projection).toHaveTextContent('10,000');
    expect(projection).toHaveTextContent(/arithmetic|not a measurement|推算|並非量測/);
  });

  it('shows no projection before anything has been corrected', () => {
    mount();
    expect(screen.queryByTestId('projection')).toBeNull();
  });

  it('calls the reference set one annotator’s reading rather than ground truth', () => {
    mount();
    const panel = screen.getByTestId('reference-panel');
    expect(panel).toHaveTextContent(/annotator|標註者/);
    expect(panel.textContent ?? '').not.toMatch(/ground truth|正確答案/i);
  });

  it('counts a box adjustment and redraws the box the student moved', async () => {
    const user = userEvent.setup();
    const { container } = mount();
    // Adjusting a box means choosing which box, then drawing the replacement. Without the first
    // step a drag is ambiguous, and the overlay would have to guess which object was meant.
    await user.selectOptions(screen.getByTestId('adjust-object'), '2');

    const svg = container.querySelector('svg') as SVGSVGElement;
    // A 1280x720 client rect over a 1280x720 image: scale 1, no letterbox.
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720 }) as DOMRect;
    fireEvent.pointerDown(svg, { clientX: 380, clientY: 450 });
    fireEvent.pointerMove(svg, { clientX: 660, clientY: 560 });
    fireEvent.pointerUp(svg, { clientX: 660, clientY: 560 });

    expect(screen.getByTestId('count-boxes')).toHaveTextContent('1');
    const rect = container.querySelector('rect[data-object-id="2"]');
    expect(rect?.getAttribute('x')).toBe('380');
    expect(rect?.getAttribute('width')).toBe('280');
  });

  it('draws from the working copy, so an adjusted box is the one on screen', async () => {
    const user = userEvent.setup();
    const { container } = mount();
    await user.selectOptions(screen.getByTestId('adjust-object'), '1');
    const svg = container.querySelector('svg') as SVGSVGElement;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720 }) as DOMRect;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 260 });
    fireEvent.pointerUp(svg, { clientX: 300, clientY: 260 });

    const rect = container.querySelector('rect[data-object-id="1"]');
    expect(rect?.getAttribute('x')).toBe('100');
    expect(rect?.getAttribute('y')).toBe('100');
    // The draft still says 230/265. Rendering the draft's objects would show that instead.
    expect(DRAFT.objects[0].bbox).toEqual({ x: 230, y: 265, w: 350, h: 260 });
  });

  it('releases the chosen box after one adjustment', async () => {
    const user = userEvent.setup();
    const { container } = mount();
    await user.selectOptions(screen.getByTestId('adjust-object'), '2');
    const svg = container.querySelector('svg') as SVGSVGElement;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720 }) as DOMRect;
    const drag = (x1: number, y1: number, x2: number, y2: number) => {
      fireEvent.pointerDown(svg, { clientX: x1, clientY: y1 });
      fireEvent.pointerMove(svg, { clientX: x2, clientY: y2 });
      fireEvent.pointerUp(svg, { clientX: x2, clientY: y2 });
    };
    drag(380, 450, 660, 560);
    expect(screen.getByTestId('adjust-object')).toHaveValue('');
    // A second drag with nothing chosen moves nothing: the annotator has to say what again.
    drag(100, 100, 300, 260);
    expect(screen.getByTestId('count-boxes')).toHaveTextContent('1');
  });

  it('does not enter draw mode until a box has been chosen to replace', () => {
    const { container } = mount();
    const svg = container.querySelector('svg') as SVGSVGElement;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720 }) as DOMRect;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 260 });
    fireEvent.pointerUp(svg, { clientX: 300, clientY: 260 });
    expect(screen.getByTestId('count-boxes')).toHaveTextContent('0');
  });

  it('works with no reference set at all', () => {
    mount({ reference: null });
    expect(screen.queryByTestId('reference-panel')).toBeNull();
    expect(counter()).toHaveTextContent('0');
  });
});
