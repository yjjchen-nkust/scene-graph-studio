import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { mdxPlugin } from '../mdx.plugin.ts';

const BACKEND = `http://127.0.0.1:${process.env.SGS_BACKEND_PORT ?? 8000}`;

export default defineConfig({
  plugins: [mdxPlugin(), react(), tailwindcss()],
  server: {
    // Bound to IPv4 explicitly. Node 18+ resolves 'localhost' verbatim, so Vite's default
    // can land on ::1 while the browser resolves localhost to 127.0.0.1 -- the dev server
    // then appears dead in Chrome while curl reaches it. Pinning the family removes the
    // ambiguity for every student on every machine.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': BACKEND, '/images': BACKEND },
  },
  // `vite preview` does not inherit `server.proxy`, and the e2e suites run against the build
  // rather than the dev server. Without this the lab routes reach the preview server itself,
  // get its HTML back, and fail on a body that is not the error model -- which is a true
  // report of a wrong question.
  preview: {
    host: '127.0.0.1',
    proxy: { '/api': BACKEND, '/images': BACKEND },
  },
});
