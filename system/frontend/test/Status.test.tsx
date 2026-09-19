import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Status from '../src/pages/Status';
import { setLocale } from '../src/i18n/useLocale';

const HEALTH = {
  status: 'ok',
  version: '0.1.0',
  torch_present: true,
  torch_version: '2.11.0+cpu',
  cuda_available: false,
  device: 'cpu',
  live_models: ['reltr'],
  vlm_provider: 'transcript',
  slices_present: { 'vg150-sgb': false, placeholder: true },
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Status />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  // useLocale keeps the current locale in module scope -- correct for the app, where a page
  // has one locale, but it means tests must put it back or they inherit the previous one.
  setLocale('zh-TW');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => HEALTH })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the health page', () => {
  it('renders the backend values rather than anything hard-coded', async () => {
    mount();
    expect(await screen.findByText('2.11.0+cpu')).toBeInTheDocument();
    expect(screen.getByText('cpu')).toBeInTheDocument();
    expect(screen.getByText('reltr')).toBeInTheDocument();
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
  });

  it('distinguishes an unpacked slice from one that is not', async () => {
    mount();
    await screen.findByText('placeholder');
    expect(screen.getByText('vg150-sgb')).toBeInTheDocument();
  });

  it('states the reason when the backend is not answering, with no stack trace', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    mount();
    expect(await screen.findByText(/uvicorn/)).toBeInTheDocument();
  });
});

describe('the locale toggle', () => {
  it('defaults to zh-TW, the project working language', async () => {
    mount();
    expect(await screen.findByText('場景圖工坊')).toBeInTheDocument();
  });

  it('swaps every label without a reload', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText('場景圖工坊');
    await user.click(screen.getByRole('button', { name: 'English' }));
    await waitFor(() => expect(screen.getByText('Scene Graph Studio')).toBeInTheDocument());
    expect(screen.queryByText('場景圖工坊')).not.toBeInTheDocument();
    expect(screen.getByText('This machine')).toBeInTheDocument();
    // The health data came from one fetch and survived the swap: no refetch, no remount.
    expect(screen.getByText('2.11.0+cpu')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('persists the choice so a reload keeps it', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText('場景圖工坊');
    await user.click(screen.getByRole('button', { name: 'English' }));
    await screen.findByText('Scene Graph Studio');
    expect(localStorage.getItem('sgs:v1:lang')).toBe('"en"');

    // A real reload re-evaluates the module, so the stored preference is read afresh.
    // Unmounting alone would not test that: the locale lives in module scope and would
    // simply survive, which proves nothing about persistence.
    cleanup();
    vi.resetModules();
    const { default: FreshStatus } = await import('../src/pages/Status');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FreshStatus />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Scene Graph Studio')).toBeInTheDocument();
  });

  it('still works when localStorage throws, as in a private window', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('site data blocked');
    });
    const user = userEvent.setup();
    mount();
    await screen.findByText('場景圖工坊');
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(await screen.findByText('Scene Graph Studio')).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
