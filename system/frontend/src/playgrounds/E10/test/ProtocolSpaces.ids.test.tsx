import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { ProtocolSpaces } from '../ProtocolSpaces';

/** How the mocked frame renumbers its objects, and which it keeps; each test sets them. */
let renumber: (id: number) => number = (id) => id;
let keep: (id: number) => boolean = () => true;

// E10 draws one committed frame, whose ids happen to run 1 to 6. Renumbering them is the only way
// to show what SGCls says about a frame whose ids do not (D101).
vi.mock('../../slice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../slice')>();
  return {
    ...actual,
    frameById: (id: string) => {
      const frame = actual.frameById(id);
      return frame && {
        ...frame,
        objects: frame.objects.filter((o) => keep(o.object_id)).map((o) => ({ ...o, object_id: renumber(o.object_id) })),
      };
    },
  };
});

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ProtocolSpaces />
    </MemoryRouter>,
  );

beforeEach(() => {
  setLocale('en');
  keep = () => true;
});

describe('E10 names the boxes SGCls hands over by their ids, not by their count', () => {
  it('lists the ids where they do not run without a gap', () => {
    renumber = (id) => (id === 3 ? 9 : id);
    renderAt('/m/m03?E10.pr=sgcls');
    expect(screen.getByTestId('e10-given')).toHaveTextContent('boxes #1, #2, #4, #5, #6, #9; no labels');
  });

  it('gives the run where they do, wherever it starts', () => {
    renumber = (id) => id + 1;
    renderAt('/m/m03?E10.pr=sgcls');
    expect(screen.getByTestId('e10-given')).toHaveTextContent('boxes #2 to #7; no labels');
  });

  it('names a single box by its id, not as a run from it to itself', () => {
    renumber = (id) => id;
    keep = (id) => id === 5;
    renderAt('/m/m03?E10.pr=sgcls');
    expect(screen.getByTestId('e10-given')).toHaveTextContent('boxes #5; no labels');
  });

  it('lists them in 繁體中文 with its own separator', () => {
    setLocale('zh-TW');
    renumber = (id) => (id === 3 ? 9 : id);
    renderAt('/m/m03?E10.pr=sgcls');
    expect(screen.getByTestId('e10-given')).toHaveTextContent('框 #1、#2、#4、#5、#6、#9；無標籤');
  });
});
