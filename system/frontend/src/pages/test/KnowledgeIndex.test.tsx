import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import assignment from '../../../../../data/content/assignment.json';
import { getMeta } from '../../content/registry';
import { setLocale } from '../../i18n/useLocale';
import { PLAYGROUND_IDS } from '../../playgrounds/mounts';
import { FieldMap } from '../FieldMap';
import { CLUSTERS, POINTS } from '../knowledge';

function Address() {
  const location = useLocation();
  return <output data-testid="address">{location.search}</output>;
}

function mount(initial = '/map') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <FieldMap />
      <Address />
    </MemoryRouter>,
  );
}

const query = () => new URLSearchParams(screen.getByTestId('address').textContent ?? '');

// The assignment says which module owns each point. A module's frontmatter also lists the points it
// only draws on, so an index read off the frontmatter sends F5 to M0, which mentions it, rather than
// to M1, which teaches it.
const TAUGHT_BY: Record<string, string> = Object.fromEntries(
  Object.entries(assignment.modules).flatMap(([m, points]) => points.map((p) => [p, m])),
);

beforeEach(() => {
  setLocale('en');
});

describe('the map as a knowledge-point index', () => {
  it('opens on the papers, so every link written before the index still lands there', () => {
    mount();
    expect(screen.getByTestId('view-papers')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('visible-count')).toBeInTheDocument();
    expect(screen.queryByTestId('kp-count')).toBeNull();
  });

  it('switches to the knowledge points and says so in the URL', () => {
    mount();
    fireEvent.click(screen.getByTestId('view-kp'));
    expect(query().get('view')).toBe('kp');
    expect(screen.getByTestId('view-kp')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('kp-count')).toHaveTextContent(`${POINTS.length} / ${POINTS.length}`);
    expect(POINTS).toHaveLength(93);
  });

  it('groups every point under its cluster', () => {
    mount('/map?view=kp');
    expect(CLUSTERS).toHaveLength(12);
    for (const c of CLUSTERS) {
      const expected = POINTS.filter((p) => p.cluster === c.id).length;
      expect(screen.getByTestId(`cluster-${c.id}`)).toHaveAttribute('data-count', String(expected));
    }
  });

  it('sends every point to the module the assignment gives it', () => {
    mount('/map?view=kp');
    for (const p of POINTS) {
      expect(TAUGHT_BY[p.id], `${p.id} is unassigned`).toBeTruthy();
      expect(screen.getByTestId(`kp-module-${p.id}`)).toHaveAttribute('href', `/m/${TAUGHT_BY[p.id]}`);
    }
    // The case that tells the owner from the first mention.
    expect(getMeta('m00', 'en')!.knowledge_points).toContain('F5');
    expect(screen.getByTestId('kp-module-F5')).toHaveAttribute('href', '/m/m01');
  });

  it('links a playground to the lecture step that mounts it, and nothing else to one', () => {
    mount('/map?view=kp');
    for (const p of POINTS) {
      const link = screen.queryByTestId(`kp-playground-${p.id}`);
      if (!PLAYGROUND_IDS.includes(p.id)) {
        expect(link, `${p.id} has no playground`).toBeNull();
        continue;
      }
      const moduleId = TAUGHT_BY[p.id]!;
      const index = Number(link!.getAttribute('href')!.split('/').pop());
      const step = getMeta(moduleId, 'en')!.steps[index]!;
      expect(link).toHaveAttribute('href', `/lecture/m/${moduleId}/${index}`);
      expect(step.kind).toBe('playground');
      expect(step.kp).toBe(p.id);
      // A split playground opens at its first part.
      expect(step.part ?? 1).toBe(1);
    }
  });

  it('filters by cluster and by search, in the URL, and says when nothing matches', () => {
    mount('/map?view=kp');
    fireEvent.change(screen.getByLabelText(/cluster/i), { target: { value: 'E' } });
    expect(query().get('cluster')).toBe('E');
    const evaluation = POINTS.filter((p) => p.cluster === 'E').length;
    expect(screen.getByTestId('kp-count')).toHaveTextContent(`${evaluation} / ${POINTS.length}`);
    expect(screen.queryByTestId('cluster-F')).toBeNull();

    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: 'e10' } });
    expect(query().get('q')).toBe('e10');
    expect(screen.getByTestId('kp-count')).toHaveTextContent(`1 / ${POINTS.length}`);
    expect(screen.getByTestId('kp-E10')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: 'no such point' } });
    expect(screen.getByTestId('kp-empty')).toBeInTheDocument();
  });

  it('finds a point by its title in either language', () => {
    const e10 = POINTS.find((p) => p.id === 'E10')!;
    mount(`/map?view=kp&q=${encodeURIComponent(e10.title_zh)}`);
    expect(screen.getByTestId('kp-E10')).toBeInTheDocument();
  });

  it('keeps the paper filters while the other view is open', () => {
    mount('/map?branch=debiasing');
    fireEvent.click(screen.getByTestId('view-kp'));
    fireEvent.click(screen.getByTestId('view-papers'));
    expect(query().get('branch')).toBe('debiasing');
    expect(query().get('view')).toBeNull();
  });

  it('is bilingual, and names the view 知識點', () => {
    setLocale('zh-TW');
    mount('/map?view=kp');
    expect(screen.getByTestId('view-kp')).toHaveTextContent('知識點');
    const f1 = POINTS.find((p) => p.id === 'F1')!;
    expect(screen.getByTestId('kp-F1')).toHaveTextContent(f1.title_zh);
    expect(screen.getByTestId(`cluster-F`)).toHaveTextContent(f1.cluster_zh);
  });
});

/**
 * One keystroke as a browser delivers it: the text and the caret are already in place when the
 * `input` event fires. `fireEvent.change` sets the value alone, which leaves the caret at the end
 * whatever the component does, so it cannot show a caret being moved.
 */
function typeAt(field: HTMLInputElement, text: string, caret: number, isComposing = false) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, text);
  field.setSelectionRange(caret, caret);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing }));
}

describe('the knowledge index’s search field', () => {
  it('keeps the caret where the reader typed, under the router’s transition', () => {
    // The router applies a navigation in a transition, so the field still held the old text when
    // React finished the keystroke and restored it, caret to the end; the transition then wrote
    // the new text, caret to the end again. The next key landed at the end of the word.
    mount('/map?view=kp&q=sce');
    const box = screen.getByLabelText(/search/i) as HTMLInputElement;
    box.focus();
    act(() => typeAt(box, 'sXce', 2));
    expect(box.value).toBe('sXce');
    expect(box.selectionStart).toBe(2);
    expect(query().get('q')).toBe('sXce');
  });

  it('writes nothing to the URL while an input method is composing, and the result at its end', () => {
    // 知 typed in 注音: the syllable ㄓ stands in the field before the character replaces it.
    mount('/map?view=kp');
    const box = screen.getByLabelText(/search/i) as HTMLInputElement;
    box.focus();
    fireEvent.compositionStart(box);
    act(() => typeAt(box, 'ㄓ', 1, true));
    act(() => typeAt(box, '知', 1, true));
    expect(query().get('q')).toBeNull();
    expect(box.value).toBe('知');

    fireEvent.compositionEnd(box, { data: '知' });
    expect(query().get('q')).toBe('知');
    expect(box.value).toBe('知');
  });

  it('hands the field back to the URL when it loses focus', () => {
    mount('/map?view=kp&q=e10');
    const box = screen.getByLabelText(/search/i) as HTMLInputElement;
    box.focus();
    act(() => typeAt(box, 'e1', 2));
    fireEvent.blur(box);
    expect(box.value).toBe('e1');
    expect(query().get('q')).toBe('e1');
  });
});
