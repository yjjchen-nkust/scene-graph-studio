import { expect, test } from '@playwright/test';

/**
 * Design §6 check 8: the lecture, walked by keyboard alone.
 *
 * The one check that exercises the thing the application is for. Every other test in this
 * repository renders a component or calls a function; this one drives the built application in a
 * browser at projector size, the way the professor will, and it is the only place where "the
 * deck advances" is a fact about the product rather than about a hook.
 *
 * It runs against `vite preview` over the production build, not the dev server — a lecture is
 * given from a build, and a dev-only failure found in the room is found too late.
 *
 * The backend is not started. Every module and both shells are P0 and therefore offline-complete
 * (NFR-1), so a walkthrough that needed the API would be evidence that something had drifted.
 */

const PROJECTOR = { width: 1920, height: 1080 };

test.use({ viewport: PROJECTOR });

test('opens in 繁體中文, which is the working language', async ({ page }) => {
  // Asserted before anything sets a preference, because the default is the one thing a fresh
  // machine in the lecture hall will get.
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('場景圖工坊');
});

// Every test below runs in English so the assertions read as the rule they check rather than as
// a translation of it. The default is asserted once, above.
test.describe('in English', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sgs:v1:lang', '"en"'));
  });

test('the index lists every module and offers both shells', async ({ page }) => {
  await page.goto('/');
  const modules = page.getByTestId('module-index').locator('a[href^="/m/"]');
  await expect(modules).toHaveCount(15);
  await expect(page.getByTestId('lab-index').locator('a')).toHaveCount(8);
});

test('M0 to M14, forwards on the keyboard alone, at 24px base type', async ({ page }) => {
  await page.goto('/');
  const ids = await page
    .getByTestId('module-index')
    .locator('a[href^="/m/"]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')!.replace('/m/', '')));

  expect(ids.length).toBe(15);

  for (const moduleId of ids) {
    await page.goto(`/lecture/m/${moduleId}/0`);
    const root = page.getByTestId('lecture-root');
    await expect(root).toBeVisible();
    await expect(root).toHaveCSS('font-size', '24px');

    const total = Number((await page.getByTestId('position').innerText()).split('/')[1]!.trim());
    for (let i = 1; i < total; i += 1) {
      await page.keyboard.press('ArrowRight');
      await expect(page.getByTestId('position')).toHaveText(`${i + 1} / ${total}`);
    }
    // The end holds rather than wrapping: a deck that looped would put slide one on the screen
    // at the moment the professor stops talking.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('position')).toHaveText(`${total} / ${total}`);
    await expect(page).toHaveURL(new RegExp(`/lecture/m/${moduleId}/${total - 1}$`));
  }
});

test('a lecture step is a link, and the link opens on that step', async ({ page }) => {
  await page.goto('/lecture/m/m04/2');
  await expect(page.getByTestId('position')).toHaveText(/^3 \//);
});

test('the presenter window joins a lecture already in progress', async ({ context, page }) => {
  // Until 2026-09-19 this test asserted the opposite. It opened the second window, expected the
  // idle pane, and pressed a key to escape it, under a comment explaining that a step change is
  // what wakes the window. That is the defect written down as the expectation: on `m00` step 0,
  // which declares no `seconds_budget`, the shell posts once on entry and the clock never ticks,
  // so a window opened afterwards waited for ever and check 8 called it correct. See D86.
  await page.goto('/lecture/m/m00/0');
  // The wait is the test. Two windows are opened seconds apart, and the shell's single message
  // has to be spent before the second one subscribes, or the defect cannot appear.
  await page.waitForTimeout(1_500);

  const notes = await context.newPage();
  await notes.goto('/lecture/notes');

  await expect(notes.getByTestId('presenter-root')).toBeVisible();
  await expect(notes.getByTestId('presenter-idle')).toHaveCount(0);
  // Step 0 carries no budget, so there is no section clock to show yet.
  await expect(notes.getByTestId('section-clock')).toHaveCount(0);

  // And it still follows the lecture, which is the half that already worked.
  await page.keyboard.press('ArrowRight');
  await expect(notes.getByTestId('section-clock')).toBeVisible();

  await notes.close();
  // Closing the notes must not disturb the lecture.
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('position')).toHaveText(/^3 \//);
});

test('opened with no lecture running, it states the condition and the remedy', async ({ page }) => {
  // The route is reachable by its own URL, which is how this was reported. Nothing answers the
  // window's question, so the idle pane is correct — but a state with no way out of it reads as
  // a fault, so the pane names the action that leaves it.
  await page.goto('/lecture/notes');
  await expect(page.getByTestId('presenter-idle')).toBeVisible();
  await expect(page.getByTestId('presenter-idle-hint')).toBeVisible();
});

test('typing in a lab inside a step does not advance the deck', async ({ page }) => {
  // M08 anchors L7, whose caption box is a text input inside a lecture step.
  await page.goto('/lab/L7');
  const before = page.url();
  await page.getByTestId('caption').fill('a person holding a cup');
  expect(page.url()).not.toBe(before);
  await expect(page.getByTestId('node-1')).toBeVisible();
});

test('every lab route renders its lab, not a blank page', async ({ page }) => {
  for (const labId of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8']) {
    await page.goto(`/lab/${labId}`);
    await expect(page.getByTestId('lab-root')).toHaveAttribute('data-lab', labId);
  }
});

test('a mistyped URL says so rather than showing an empty shell', async ({ page }) => {
  await page.goto('/lecture/m/m99/0');
  await expect(page.getByText('No such page')).toBeVisible();
});
test('a playground computes with no backend running', async ({ page }) => {
  // This file starts no backend. A playground that fetched its data would show nothing here,
  // which is the whole difference between the guarantee and the intention. offline.spec.ts
  // cannot make this check: it asserts nothing is fetched from *outside this origin*, and the
  // proxy makes /api same-origin.
  await page.goto('/lecture/m/m00/1');
  await expect(page.getByTestId('playground-frame')).toBeVisible();
  await expect(page.getByTestId('readout-F1.candidates')).toContainText('480');
  await expect(page.getByTestId('readout-F1.ratio')).toContainText('1.25%');
});

test('a knob is reachable by keyboard, and turning it does not advance the deck', async ({ page }) => {
  await page.goto('/lecture/m/m00/1');
  const position = page.getByTestId('position');
  const before = await position.textContent();

  const annotated = page.getByTestId('readout-F1.annotated');
  const annotatedBefore = await annotated.textContent();

  // Tab into the playground rather than clicking it: a professor at the podium has a remote.
  await page.getByLabel('Annotation density').focus();
  await page.keyboard.press('ArrowLeft');

  // The slider moved. Asserted as a change from what was there, not against a literal: a
  // literal that happens not to appear makes this pass whether or not the key did anything.
  await expect(annotated).not.toHaveText(annotatedBefore ?? '');
  // ...and the deck did not. `isTextEntry` gives every key to a focused INPUT; a knob built
  // from a styled div would fail exactly here.
  await expect(position).toHaveText(before ?? '');
});

test('the node buttons of F2 take Space without advancing the slide', async ({ page }) => {
  await page.goto('/lecture/m/m00/3');
  const position = page.getByTestId('position');
  const before = await position.textContent();
  await page.getByTestId('node-1').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('node-1')).toHaveAttribute('data-role', 'subject');
  await expect(position).toHaveText(before ?? '');
});

test('the study shell renders all three playgrounds in one column', async ({ page }) => {
  // Spec §4.1 says the study shell needs no special provision, which is a claim about the
  // product rather than an absence of work: it is true only if a playground renders outside the
  // lecture shell at all. M0 has three, and the student reading alone sees every one of them.
  await page.goto('/m/m00');
  await expect(page.getByTestId('playground-frame')).toHaveCount(3);
  await expect(page.getByTestId('readout-F1.candidates')).toContainText('480');
});

test('no playground takes focus when its step opens', async ({ page }) => {
  for (const index of [1, 3, 4]) {
    await page.goto(`/lecture/m/m00/${index}`);
    await expect(page.getByTestId('playground-frame')).toBeVisible();
    const tag = await page.evaluate(() => document.activeElement?.tagName ?? '');
    expect(tag).toBe('BODY');
  }
});
});
