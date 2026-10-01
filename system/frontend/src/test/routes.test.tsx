import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMeta, moduleIds } from '../content/registry';
import { setLocale } from '../i18n/useLocale';
import { loadProgress } from '../store/persist';
import { LAB_IDS } from '../labs/registry';
import { ROUTES } from '../routes';
import { PRESENTER_CHANNEL } from '../shells/lecture/useStepper';

function open(path: string) {
  const router = createMemoryRouter(ROUTES, { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const FIRST = 'm00';

beforeEach(() => {
  localStorage.clear();
  setLocale('en');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
  );
});

describe('the route table', () => {
  it('lists every module on the index, in curriculum order', () => {
    open('/');
    const links = screen.getByTestId('module-index').querySelectorAll('a[href^="/m/"]');
    expect(links).toHaveLength(moduleIds().length);

    const orders = [...links].map((a) => {
      const id = a.getAttribute('href')!.replace('/m/', '');
      return getMeta(id, 'en')!.order;
    });
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('opens a module in the study shell', () => {
    open(`/m/${FIRST}`);
    expect(screen.getByText(getMeta(FIRST, 'en')!.title_en)).toBeInTheDocument();
    // The study shell shows the whole module, not one step.
    expect(document.querySelectorAll('[data-step-id]').length).toBeGreaterThan(1);
  });

  it('opens a module in the lecture shell at the step the URL names', () => {
    open(`/lecture/m/${FIRST}/1`);
    expect(screen.getByTestId('position')).toHaveTextContent('2 / ');
  });

  it('sends a bare lecture URL to step zero rather than nowhere', async () => {
    const router = open(`/lecture/m/${FIRST}`);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/lecture/m/${FIRST}/0`),
    );
    expect(screen.getByTestId('position')).toHaveTextContent('1 / ');
  });

  it('walks the lecture with the keyboard and leaves the URL on the step', () => {
    const router = open(`/lecture/m/${FIRST}/0`);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(router.state.location.pathname).toBe(`/lecture/m/${FIRST}/1`);
  });

  it('keeps a knob mounted and focused when it writes the query string', () => {
    // M1 s6 is F7's first part. A knob writes its value into the URL, the route re-renders, and
    // the step's body must survive it: remounted, the slider loses focus to <body> and the next
    // arrow key moves the deck instead of the knob.
    const router = open('/lecture/m/m01/5');
    const knob = screen.getByTestId('F7.s');
    knob.focus();
    fireEvent.change(knob, { target: { value: '1.5' } });
    expect(router.state.location.search).toContain('F7.s=1.5');
    expect(screen.getByTestId('F7.s')).toBe(knob);
    expect(document.activeElement).toBe(knob);
  });

  it('mounts the field map', () => {
    open('/map');
    expect(screen.getByTestId('visible-count')).toBeInTheDocument();
  });

  it('mounts the leaderboards', () => {
    open('/leaderboards');
    expect(screen.getAllByTestId('provenance').length).toBeGreaterThan(0);
  });

  it('mounts the machine status page', () => {
    open('/status');
    expect(screen.getByRole('heading', { name: 'Scene Graph Studio' })).toBeInTheDocument();
  });

  it('mounts the presenter window, and it reaches the real seeded notes', async () => {
    open('/lecture/notes');
    expect(screen.getByTestId('presenter-idle')).toBeInTheDocument();

    const channel = new BroadcastChannel(PRESENTER_CHANNEL);
    channel.postMessage({ moduleId: FIRST, stepIndex: 0, remainingSeconds: null });
    channel.close();

    // Through the registry and the real MDX frontmatter, not a fixture: D56 was exactly a chain
    // that type-checked end to end and carried nothing.
    expect(await screen.findByTestId('notes')).toHaveTextContent('three photographs');
  });

  it('puts a checkpoint quiz in the study column, where it can be reached', () => {
    open(`/m/${FIRST}`);
    // M0's last step is a checkpoint. A quiz module nothing mounts is the D52 defect again.
    expect(screen.getByTestId('item-position')).toBeInTheDocument();
  });

  it('records how far the reader got, and offers to resume', async () => {
    open(`/m/${FIRST}`);
    await waitFor(() => expect(loadProgress().modules[FIRST]).toBeGreaterThan(0));

    cleanup();
    open('/');
    expect(screen.getByTestId('resume')).toHaveTextContent(FIRST);
    expect(screen.getByTestId(`seen-${FIRST}`)).toBeInTheDocument();
  });

  it('advancing the lecture moves the record forward', async () => {
    open(`/lecture/m/${FIRST}/0`);
    await waitFor(() => expect(loadProgress().modules[FIRST]).toBe(1));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(loadProgress().modules[FIRST]).toBe(2));
  });

  it('says so when a module id is not in the corpus', () => {
    open('/m/m99');
    expect(screen.getByText('No such page')).toBeInTheDocument();
    expect(screen.getByText('m99')).toBeInTheDocument();
  });

  it('says so for a path that matches nothing at all', () => {
    open('/nowhere');
    expect(screen.getByText('No such page')).toBeInTheDocument();
  });

  it('reaches every lab from the index without a typed URL', () => {
    open('/');
    const hrefs = [...screen.getByTestId('lab-index').querySelectorAll('a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toEqual(LAB_IDS.map((id) => `/lab/${id}`));
  });

  it('reaches the lecture from the index without a typed URL', () => {
    open('/');
    const lecture = screen.getByTestId('module-index').querySelector('a[href^="/lecture/"]');
    expect(lecture).toHaveAttribute('href', `/lecture/m/${FIRST}/0`);
  });
});
