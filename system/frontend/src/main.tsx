import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Bundled from npm, fonts and all: NFR-1 forbids fetching anything at run time.
import 'katex/dist/katex.min.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import './index.css';
import { ROUTES } from './routes';

// The corpora are immutable for a session, so nothing refetches. Contracts section 2.3.
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnWindowFocus: false } },
});

// Data-router mode, per contracts section 2.2. Built once at module scope: building it inside a
// component would hand React a new router on every render and drop the history with it.
// `BASE_URL` is `/` locally and `/<repository>/` on GitHub Pages; the router wants no trailing slash.
const router = createBrowserRouter(ROUTES, {
  basename: import.meta.env.BASE_URL.replace(/(.)\/$/, '$1'),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
