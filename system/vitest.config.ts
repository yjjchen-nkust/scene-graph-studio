import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { mdxPlugin } from './mdx.plugin.ts';

export default defineConfig({
  test: {
    projects: [
      {
        // The engine package: no DOM, no React, no fetch. Kept deliberately dependency-free
        // so the golden vectors exercise it in isolation.
        test: {
          name: 'metrics',
          include: ['packages/**/test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        // The build-time tools: plain ESM, no DOM. They read committed artefacts and assert
        // the harvest has not drifted from the frozen page it came out of.
        test: {
          name: 'tools',
          include: ['tools/test/**/*.test.mjs'],
          environment: 'node',
        },
      },
      {
        // The same plugin the build uses, so a module cannot typeset here and fail there.
        plugins: [mdxPlugin(), react()],
        // The root has no tsconfig declaring jsx, so esbuild would fall back to the classic
        // runtime and every render would fail with 'React is not defined'. Pin it here.
        esbuild: { jsx: 'automatic' },
        // The F1 playground's import.meta.glob reads slice images from data/, which sits
        // one level above this config's root (system/), as a sibling rather than a
        // descendant. Vite's filesystem guard denies any read outside the root by default,
        // so the allow list has to be widened by one level. Setting server.fs.allow
        // replaces Vite's own defaults rather than adding to them, but the root (system/)
        // is itself a descendant of that parent, so listing the parent alone still covers
        // every path the defaults used to.
        server: { fs: { allow: ['..'] } },
        test: {
          name: 'frontend',
          // Component tests live beside the component; frontend/test/ holds the
          // app-level ones. Both are picked up.
          //
          // `.ts` as well as `.tsx`: a lab's logic module is not a component and its test
          // should not have to pretend to be one. Until L3 this pattern was .tsx only, so a
          // plain .ts test under frontend/src/ was collected by no project at all and would
          // have passed by never running.
          include: ['frontend/test/**/*.test.{ts,tsx}', 'frontend/src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['frontend/test/setup.ts'],
        },
      },
    ],
  },
});
