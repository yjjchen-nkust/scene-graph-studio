import { defineConfig, devices } from '@playwright/test';

/**
 * Design §6 check 8, as a runnable configuration.
 *
 * `vite preview` over the production build, not the dev server: a lecture is given from a build,
 * and a failure that only the dev server hides is found in the room. The backend is deliberately
 * not started — every module and both shells are P0 and therefore offline-complete (NFR-1), so a
 * walkthrough that needed the API would itself be the finding.
 */
export default defineConfig({
  testDir: './e2e',
  // `offline.spec.ts` asserts a machine state — no torch, one slice — that only
  // `tools/offline_check.mjs` arranges, so a plain `playwright test` would run it against the
  // author's own backend and report three failures that mean nothing. The offline check names
  // the file explicitly; everything else is the default run.
  //
  // `perf.spec.ts` is excluded for the opposite reason: it needs a backend, which this config
  // deliberately does not start, so `check:perf` starts one and names the file itself.
  testIgnore: [
    ...(process.env.SGS_OFFLINE ? [] : ['**/offline.spec.ts']),
    ...(process.env.SGS_PERF ? [] : ['**/perf.spec.ts']),
  ],
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build:frontend && npm run preview --workspace frontend -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
