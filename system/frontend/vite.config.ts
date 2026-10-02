import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { dataDirectory } from '../data.dir.ts';
import { crossDriveFs } from '../fs.plugin.ts';
import { mdxPlugin } from '../mdx.plugin.ts';

const BACKEND = `http://127.0.0.1:${process.env.SGS_BACKEND_PORT ?? 8000}`;

export default defineConfig({
  plugins: [mdxPlugin(), react(), tailwindcss(), crossDriveFs()],
  server: {
    // Bound to IPv4 explicitly. Node 18+ resolves 'localhost' verbatim, so Vite's default
    // can land on ::1 while the browser resolves localhost to 127.0.0.1 -- the dev server
    // then appears dead in Chrome while curl reaches it. Pinning the family removes the
    // ambiguity for every student on every machine.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': BACKEND, '/images': BACKEND },
    // The demos' clip and frames and the playgrounds' photographs are imported from data/,
    // which is a sibling of system/ and a link to the NAS (D110). Vite serves a file outside
    // this list as index.html with status 200, so a <video> reported a demuxer error and an
    // <img> a broken image while the build, which bundles them, showed both. The guard checks
    // real paths, so the link's target is listed, as vitest.config.ts lists it; setting the list
    // replaces Vite's default, so the workspace root is restated. That target can lie on another
    // drive than the checkout, which Vite's own /@fs/ cannot read; `crossDriveFs` does (D123).
    fs: { allow: [searchForWorkspaceRoot(import.meta.dirname), dataDirectory()] },
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
