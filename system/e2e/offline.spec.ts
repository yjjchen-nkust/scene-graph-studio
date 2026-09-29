import { expect, test, type Page, type Request } from '@playwright/test';

/**
 * Design §6 check 6: the offline run.
 *
 * The check asks for a machine with the network down, `torch` uninstalled and the slices never
 * fetched. Two of those are arranged by `tools/offline_check.mjs`, which starts the backend on a
 * torch-free interpreter and points `SGS_DATA_DIR` at a scratch directory holding nothing but
 * the placeholder slice. The third is arranged here, and **more strictly than unplugging a
 * cable would**: every request to anything but this origin is aborted and recorded, so the run
 * fails on the attempt rather than on the timeout.
 *
 * That difference matters. A disconnected machine tells you the application survived a fetch it
 * should never have made; interception tells you it never made one. The second is the property
 * NFR-1 actually states.
 */

const ORIGIN = 'http://127.0.0.1';

function offline(page: Page): { attempts: string[] } {
  const attempts: string[] = [];
  page.route('**/*', async (route, request: Request) => {
    const url = request.url();
    if (url.startsWith(ORIGIN) || url.startsWith('data:') || url.startsWith('blob:')) {
      await route.continue();
      return;
    }
    attempts.push(`${request.method()} ${url}`);
    await route.abort('internetdisconnected');
  });
  return { attempts };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sgs:v1:lang', '"en"'));
});

test('the guard the rest of this file relies on can fail', async ({ page }) => {
  // Every test below ends in `expect(attempts).toEqual([])`, which is worth exactly as much as
  // the recorder behind it. Both request paths a page can take are provoked here and both are
  // caught, so an empty list below is a fact and not an empty implementation.
  const seen = offline(page);
  await page.goto('/');

  await page.evaluate(async () => {
    try {
      await fetch('https://fonts.googleapis.com/css2?family=X');
    } catch {
      /* aborted, which is the point */
    }
  });
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        const img = new Image();
        img.onload = () => done();
        img.onerror = () => done();
        img.src = 'https://example.com/x.png';
      }),
  );

  expect(seen.attempts).toEqual([
    'GET https://fonts.googleapis.com/css2?family=X',
    'GET https://example.com/x.png',
  ]);
});

test('the machine reports no torch and only the placeholder slice', async ({ page }) => {
  const seen = offline(page);
  await page.goto('/status');

  // Wait for the answer before reading the page. The panel renders "Asking the backend…" until
  // the query resolves, and reading through it made this test fail once in three runs on a
  // fast machine — a flake that would have been blamed on the application.
  await expect(page.getByText('Asking the backend')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Slices' })).toBeVisible();

  // The panel reads /api/health, so this asserts the backend's own answer rather than a fixture.
  const body = await page.locator('body').innerText();
  expect(body, 'PyTorch should report as not installed').toContain('not installed');
  expect(body, 'no model can run live without torch').toContain('none —');
  // Exactly one slice is unpacked here, and it is the one every clone can generate.
  expect(body).toContain('placeholder');
  const unpacked = await page.getByText('unpacked', { exact: true }).count();
  expect(unpacked, 'only the placeholder slice should be unpacked').toBe(1);
  expect(seen.attempts).toEqual([]);
});

test('every module opens with nothing fetched from outside this origin', async ({ page }) => {
  const seen = offline(page);
  await page.goto('/');

  const ids = await page
    .getByTestId('module-index')
    .locator('a[href^="/m/"]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')!.replace('/m/', '')));
  expect(ids.length).toBe(15);

  for (const moduleId of ids) {
    await page.goto(`/m/${moduleId}`);
    await expect(page.locator('[data-step-id]').first()).toBeVisible();
  }
  expect(seen.attempts).toEqual([]);
});

test('the mathematics is already typeset, so no font or script is fetched', async ({ page }) => {
  const seen = offline(page);
  // M04 is the metrics module: eight math steps, the heaviest KaTeX in the corpus.
  await page.goto('/m/m04');
  await expect(page.locator('.katex').first()).toBeVisible();
  expect(seen.attempts).toEqual([]);
});

test('the lecture walks M0 to M14 by keyboard with the network intercepted', async ({ page }) => {
  const seen = offline(page);
  await page.goto('/');
  const ids = await page
    .getByTestId('module-index')
    .locator('a[href^="/m/"]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')!.replace('/m/', '')));

  for (const moduleId of ids) {
    await page.goto(`/lecture/m/${moduleId}/0`);
    const total = Number((await page.getByTestId('position').innerText()).split('/')[1]!.trim());
    for (let i = 1; i < total; i += 1) await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('position')).toHaveText(`${total} / ${total}`);
  }
  expect(seen.attempts).toEqual([]);
});

test('the nine demo parts open with nothing fetched from outside this origin', async ({ page }) => {
  // M0's demos replay recordings bundled into the build: the clip, the ten frames and both
  // artefacts. The clip is on D-T's and D-V's first parts (steps 6 and 10), and its metadata has
  // to arrive, from this origin, for either to show it.
  const seen = offline(page);
  const withClip = new Set([6, 10]);
  for (let step = 6; step <= 14; step += 1) {
    await page.goto(`/lecture/m/m00/${step}`);
    await expect(page.getByTestId('demo-frame'), `m00/${step}`).toBeVisible();
    const clip = page.getByTestId('demo-clip');
    await expect(clip, `m00/${step}`).toHaveCount(withClip.has(step) ? 1 : 0);
    if (!withClip.has(step)) continue;
    await expect
      .poll(() => clip.evaluate((v: HTMLVideoElement) => v.readyState), { message: `m00/${step}: the clip's metadata never arrived` })
      .toBeGreaterThanOrEqual(1);
    const source = await clip.evaluate((v: HTMLVideoElement) => v.currentSrc);
    expect(source.startsWith(ORIGIN), `m00/${step}: the clip came from ${source}`).toBe(true);
  }
  expect(seen.attempts).toEqual([]);
});

test('every lab renders on the placeholder slice alone', async ({ page }) => {
  const seen = offline(page);
  for (const labId of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8']) {
    await page.goto(`/lab/${labId}`);
    await expect(page.getByTestId('lab-root')).toHaveAttribute('data-lab', labId);
    // A lab that cannot show its data must say why. A blank panel is the failure NFR-1 names.
    const failure = page.getByTestId('lab-failure');
    if (await failure.count()) {
      const text = await failure.innerText();
      expect(text.length, `${labId} failed with an empty reason`).toBeGreaterThan(10);
      expect(text, `${labId} leaked a stack frame`).not.toMatch(/at \w+ \(/);
    }
  }
  expect(seen.attempts).toEqual([]);
});

test('live inference states a reason rather than a stack trace', async ({ request }) => {
  // Not through the page: this is the backend's refusal, and it has to be the documented one.
  const response = await request.post('/api/infer/motifs', {
    data: { dataset: 'placeholder', image_id: 'ph-001' },
    failOnStatusCode: false,
  });
  expect(response.status()).toBe(503);
  const body = await response.json();
  expect(body.error.code).toBe('inference_unavailable');
  expect(body.error.message_en.length).toBeGreaterThan(10);
  expect(body.error.message_zh.length).toBeGreaterThan(5);
  expect(body.error.detail.torch_present).toBe(false);
  expect(JSON.stringify(body)).not.toMatch(/Traceback|at \w+ \(/);
});

test('the live VLM states a reason rather than failing silently', async ({ request }) => {
  const response = await request.post('/api/vlm/indvissgg', {
    data: { dataset: 'mini-isg', image_id: 'isg-001', provider: 'claude', steps: [1] },
    failOnStatusCode: false,
  });
  expect(response.status()).toBe(503);
  const body = await response.json();
  expect(body.error.code).toBe('vlm_unavailable');
  expect(JSON.stringify(body)).not.toMatch(/Traceback|at \w+ \(/);
});
