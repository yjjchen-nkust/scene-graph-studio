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
  // proxy makes /api same-origin. F1's readouts are its second part (D96).
  await page.goto('/lecture/m/m00/2');
  await expect(page.getByTestId('playground-frame')).toBeVisible();
  await expect(page.getByTestId('readout-F1.candidates')).toContainText('480');
  await expect(page.getByTestId('readout-F1.ratio')).toContainText('1.25%');
});

test('a knob is reachable by keyboard, and turning it does not advance the deck', async ({ page }) => {
  await page.goto('/lecture/m/m00/2');
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
  await page.goto('/lecture/m/m00/4');
  const position = page.getByTestId('position');
  const before = await position.textContent();
  await page.getByTestId('node-1').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('node-1')).toHaveAttribute('data-role', 'subject');
  await expect(position).toHaveText(before ?? '');
});

test('the study shell renders every playground of M0 to M3 in one column', async ({ page }) => {
  // Spec §4.1 says the study shell needs no special provision, which is a claim about the
  // product rather than an absence of work: it is true only if a playground renders outside the
  // lecture shell at all. M0 has three, and the student reading alone sees every one of them.
  // A playground split across steps is a frame a part here, F1 two and X1 three (D96). M0's
  // two demos are nine frames more, one a part (D-T four, D-V five), and none is a playground's.
  await page.goto('/m/m00');
  await expect(page.getByTestId('playground-frame')).toHaveCount(4);
  await expect(page.getByTestId('demo-frame')).toHaveCount(9);
  await expect(page.getByTestId('readout-F1.candidates')).toContainText('480');
  await page.goto('/m/m01');
  await expect(page.getByTestId('playground-frame')).toHaveCount(7);
  await page.goto('/m/m02');
  await expect(page.getByTestId('playground-frame')).toHaveCount(2);
  await page.goto('/m/m03');
  await expect(page.getByTestId('playground-frame')).toHaveCount(4);
});

test('turning a knob writes it into the address bar, so the setting is a link', async ({ page }) => {
  // Spec §4.3's operative claim is that a knob setting becomes a link, so a presenter note can
  // name the setting to open on. Every other URL test in this repository supplies the state
  // through the URL and checks the component reads it; nothing checked the write direction, so
  // if `setParams` stopped reaching the address bar every one of them would still pass. That is
  // the defect D88 records for F2's predicate -- advertised by its id and ignored -- and the
  // guard added there covered only the read side.
  await page.goto('/lecture/m/m00/1');
  await expect(page.getByTestId('playground-frame')).toBeVisible();
  expect(page.url()).not.toContain('F1.labels');
  await page.getByTestId('F1.labels').click();
  await expect(page).toHaveURL(/F1\.labels=0/);

  await page.goto('/lecture/m/m00/4');
  await expect(page.getByTestId('playground-frame')).toBeVisible();
  await page.getByTestId('F2.predicate').selectOption('near');
  await expect(page).toHaveURL(/F2\.predicate=near/);

  await page.goto('/lecture/m/m00/5');
  await expect(page.getByTestId('playground-frame')).toBeVisible();
  await page.getByTestId('F8.swap').click();
  await expect(page).toHaveURL(/F8\.swap=1/);

  // And the link round-trips: the URL the knob wrote reproduces the state when opened cold.
  const shared = page.url();
  await page.goto('about:blank');
  await page.goto(shared);
  await expect(page.getByTestId('f8-status')).toHaveText(/Not recorded in E/);
});

test('no playground takes focus when its step opens', async ({ page }) => {
  for (const [module, index] of [
    ['m00', 1], ['m00', 2], ['m00', 4], ['m00', 5],
    ['m01', 2], ['m01', 3], ['m01', 5], ['m01', 6], ['m01', 8], ['m01', 9], ['m01', 10],
    ['m02', 2], ['m02', 3], ['m03', 2], ['m03', 3], ['m03', 5], ['m03', 6],
    ['m05', 2], ['m05', 4], ['m05', 5],
  ] as const) {
    await page.goto(`/lecture/m/${module}/${index}`);
    await expect(page.getByTestId('playground-frame')).toBeVisible();
    const tag = await page.evaluate(() => document.activeElement?.tagName ?? '');
    expect(tag).toBe('BODY');
  }
});

test('M1\'s playgrounds compute with no backend running', async ({ page }) => {
  await page.goto('/lecture/m/m01/2');
  await expect(page.getByTestId('readout-F6.predicates-value')).toHaveText('36');
  await page.goto('/lecture/m/m01/5');
  await expect(page.getByTestId('readout-F7.head-value')).toHaveText(/%$/);
  await page.goto('/lecture/m/m01/8');
  await expect(page.getByTestId('x1-train-a')).toContainText('68,538');
});

test('M1\'s knobs work from the keyboard and never advance the deck', async ({ page }) => {
  const cases = [
    { step: 2, knob: 'F6.mp', key: 'Space', watch: 'readout-F6.predicates-value' },
    { step: 5, knob: 'F7.s', key: 'ArrowRight', watch: 'readout-F7.head-value' },
    // ArrowUp, not ArrowDown: the default, sgb-v2, is the last option, so ArrowDown would change
    // nothing and the test would report a keyboard failure that is really the end of the list.
    { step: 8, knob: 'X1.r', key: 'ArrowUp', watch: 'x1-train-a' },
  ];
  for (const c of cases) {
    await page.goto(`/lecture/m/m01/${c.step}`);
    const position = page.getByTestId('position');
    const before = await position.textContent();
    const watched = page.getByTestId(c.watch);
    const was = await watched.textContent();
    await page.getByTestId(c.knob).focus();
    await page.keyboard.press(c.key);
    await expect(watched, `${c.knob} moved nothing`).not.toHaveText(was ?? '');
    await expect(position, `${c.knob} advanced the deck`).toHaveText(before ?? '');
  }
});

test('M1\'s knobs write the address bar', async ({ page }) => {
  await page.goto('/lecture/m/m01/2');
  await page.getByTestId('F6.mp').click();
  await expect(page).toHaveURL(/F6\.mp=1/);
  // F7's overlay toggle exists only when the playground is mounted without a part, which no step
  // does; its second part shows the slice (D96), so the knob written here is the head.
  await page.goto('/lecture/m/m01/5');
  await page.getByTestId('F7.k').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/F7\.k=4/);
  await page.goto('/lecture/m/m01/8');
  await page.getByTestId('X1.r').selectOption('sgb-v1');
  await expect(page).toHaveURL(/X1\.r=sgb-v1/);
  const shared = page.url();
  await page.goto('about:blank');
  await page.goto(shared);
  await expect(page.getByTestId('x1-train-a')).toContainText('73,538');
});

test('M2\'s playground computes with no backend running', async ({ page }) => {
  await page.goto('/lecture/m/m02/2');
  await expect(page.getByTestId('readout-F3.iou-value')).toHaveText('1.000');
  await page.goto('/lecture/m/m02/3');
  await expect(page.getByTestId('f3-member')).toHaveText(/IoU ≥ τ/);
});

test('F3\'s scale crosses from its first part to its second, and the second says no placement reaches τ', async ({ page }) => {
  // Part 2 compares IoU and the bound with τ; the λ set on part 1 is what it compares (D96).
  await page.goto('/lecture/m/m02/2?F3.lambda=1.5');
  await expect(page.getByTestId('readout-F3.bound-value')).toHaveText('0.444');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('f3-unreachable')).toBeVisible();
  await expect(page.getByTestId('readout-F3.bound-value')).toHaveText('0.444');
});

test('M2\'s knobs work from the keyboard and never advance the deck', async ({ page }) => {
  const cases = [
    { at: '', knob: 'F3.dx', watch: 'readout-F3.iou-value' },
    { at: '', knob: 'F3.dy', watch: 'readout-F3.iou-value' },
    { at: '', knob: 'F3.lambda', watch: 'readout-F3.iou-value' },
    // Opened where IoU is exactly 0.5 = τ, so one step of τ turns "IoU ≥ τ" into "IoU < τ": the
    // knob moves the one line it governs, and the boundary is inclusive in the browser too.
    { at: '?F3.dx=30', knob: 'F3.tau', watch: 'f3-member', step: 3 },
  ];
  for (const c of cases) {
    await page.goto(`/lecture/m/m02/${c.step ?? 2}${c.at}`);
    const position = page.getByTestId('position');
    const before = await position.textContent();
    const watched = page.getByTestId(c.watch);
    const was = await watched.textContent();
    await page.getByTestId(c.knob).focus();
    await page.keyboard.press('ArrowRight');
    await expect(watched, `${c.knob} moved nothing`).not.toHaveText(was ?? '');
    await expect(position, `${c.knob} advanced the deck`).toHaveText(before ?? '');
  }
  await expect(page.getByTestId('f3-member')).toHaveText(/IoU < τ/);
});

test('M2\'s knobs write the address bar', async ({ page }) => {
  await page.goto('/lecture/m/m02/2');
  await page.getByTestId('F3.lambda').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/F3.lambda=1.1/);
  const shared = page.url();
  await page.goto('about:blank');
  await page.goto(shared);
  // 99 x 77: λ = 1.1 on the 90 x 70 annotation, which the prediction contains.
  await expect(page.getByTestId('readout-F3.union-value')).toContainText('7,623');
});

test('M3\'s playgrounds compute with no backend running', async ({ page }) => {
  await page.goto('/lecture/m/m03/3');
  await expect(page.getByTestId('e1-verdict')).toHaveText(/match/);
  await page.goto('/lecture/m/m03/6');
  await expect(page.getByTestId('e10-row-predcls')).toContainText('480');
});

test('M3\'s knobs cross from each first part to its second', async ({ page }) => {
  // D96 carries the query string between the parts of one playground: the verdict on E1's second
  // part is the one the defects set on its first, and E10's counts mark the protocol chosen there.
  await page.goto('/lecture/m/m03/2?E1.p=1');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('e1-verdict')).toHaveText(/spurious/);
  await page.goto('/lecture/m/m03/5?E10.pr=sgdet');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('e10-row-sgdet')).toHaveAttribute('aria-current', 'true');
});

test('M3\'s knobs work from the keyboard and never advance the deck', async ({ page }) => {
  const cases = [
    { step: 3, knob: 'E1.bs', key: 'Space', watch: 'e1-verdict' },
    { step: 5, knob: 'E10.pr', key: 'ArrowDown', watch: 'e10-given' },
  ];
  for (const c of cases) {
    await page.goto(`/lecture/m/m03/${c.step}`);
    const position = page.getByTestId('position');
    const before = await position.textContent();
    const watched = page.getByTestId(c.watch);
    const was = await watched.textContent();
    await page.getByTestId(c.knob).focus();
    await page.keyboard.press(c.key);
    await expect(watched, `${c.knob} moved nothing`).not.toHaveText(was ?? '');
    await expect(position, `${c.knob} advanced the deck`).toHaveText(before ?? '');
  }
});

test('M3\'s knobs write the address bar', async ({ page }) => {
  await page.goto('/lecture/m/m03/2');
  await page.getByTestId('E1.p').click();
  await expect(page).toHaveURL(/E1\.p=1/);
  await page.goto('/lecture/m/m03/5');
  await page.getByTestId('E10.pr').selectOption('sgdet');
  await expect(page).toHaveURL(/E10\.pr=sgdet/);
  const shared = page.url();
  await page.goto('about:blank');
  await page.goto(shared);
  await expect(page.getByTestId('e10-given')).toHaveText(/無框、無標籤|no boxes, no labels/);
});

test('M4\'s playgrounds compute with no backend running', async ({ page }) => {
  await page.goto('/lecture/m/m04/3');
  await expect(page.getByTestId('readout-E3.truths-value')).toHaveText('3');
  await page.goto('/lecture/m/m04/6');
  await expect(page.getByTestId('readout-E4.truths-value')).toHaveText('2');
  await expect(page.getByTestId('readout-E4.truths_none-value')).toHaveText('1');
  await page.goto('/lecture/m/m04/10');
  await expect(page.getByTestId('readout-E7.pool-value')).toHaveText('7');
  await page.goto('/lecture/m/m04/13');
  await expect(page.getByTestId('readout-E13.admitted-value')).toHaveText('1');
  await page.goto('/lecture/m/m04/15');
  await expect(page.getByTestId('readout-X2.pool-value')).toHaveText('300');
});

test('M4\'s knobs cross from each first part to its second', async ({ page }) => {
  // D96 carries the query string between the parts of one playground: the mode set on E4's first
  // part is the one its second counts under, and the m set on E7's first is the one its second
  // pools under (Review Focus 5).
  await page.goto('/lecture/m/m04/5?E4.mode=none');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('readout-E4.pool-value')).toHaveText('12');
  await page.goto('/lecture/m/m04/9?E7.m=2');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('readout-E7.pool-value')).toHaveText('11');
});

test('M4\'s knobs work from the keyboard and never advance the deck', async ({ page }) => {
  const cases = [
    { step: 3, knob: 'E3.k', key: 'ArrowRight', watch: 'readout-E3.in_top-value' },
    { step: 6, knob: 'E4.mode', key: 'ArrowDown', watch: 'readout-E4.pool-value' },
    { step: 10, knob: 'E7.m', key: 'ArrowRight', watch: 'readout-E7.pool-value' },
    { step: 13, knob: 'E13.multi', key: 'Space', watch: 'readout-E13.admitted-value' },
    { step: 15, knob: 'X2.m', key: 'ArrowDown', watch: 'readout-X2.pool-value' },
  ];
  for (const c of cases) {
    await page.goto(`/lecture/m/m04/${c.step}`);
    const position = page.getByTestId('position');
    const before = await position.textContent();
    const watched = page.getByTestId(c.watch);
    const was = await watched.textContent();
    await page.getByTestId(c.knob).focus();
    await page.keyboard.press(c.key);
    await expect(watched, `${c.knob} moved nothing`).not.toHaveText(was ?? '');
    await expect(position, `${c.knob} advanced the deck`).toHaveText(before ?? '');
  }
});

test('M4\'s knobs write the address bar', async ({ page }) => {
  await page.goto('/lecture/m/m04/5');
  await page.getByTestId('E4.mode').selectOption('none');
  await expect(page).toHaveURL(/E4\.mode=none/);
});

test('M5\'s playgrounds compute with no backend running', async ({ page }) => {
  await page.goto('/lecture/m/m05/2');
  await expect(page.getByTestId('readout-T1.pairs-value')).toHaveText('240');
  await expect(page.getByTestId('readout-T1.related-value')).toHaveText('5');
  await expect(page.getByTestId('readout-T1.slice-value')).toHaveText('651 / 26,282');
  await page.goto('/lecture/m/m05/4');
  await expect(page.getByTestId('t2-belief-1-bt')).toHaveText('0.90');
  // T2's readouts are its second part (D96, D111): the table alone sits on the first.
  await page.goto('/lecture/m/m05/5');
  await expect(page.getByTestId('readout-T2.spread-value')).toHaveText('0.8000');
  await expect(page.getByTestId('readout-T2.bound-value')).toHaveText('0.2065');
});

test('M5\'s knobs work from the keyboard and never advance the deck', async ({ page }) => {
  const cases = [
    { step: 2, knob: 'T1.frame', key: 'ArrowRight', watch: 'readout-T1.rows-value' },
    { step: 4, knob: 'T2.t', key: 'ArrowRight', watch: 't2-belief-1-bt' },
    { step: 4, at: '?T2.t=1', knob: 'T2.w', key: 'ArrowRight', watch: 't2-belief-1-bt' },
    { step: 4, knob: 'T2.graph', key: 'ArrowDown', watch: 't2-belief-1-nb' },
  ];
  for (const c of cases) {
    await page.goto(`/lecture/m/m05/${c.step}${c.at ?? ''}`);
    const position = page.getByTestId('position');
    const before = await position.textContent();
    const watched = page.getByTestId(c.watch);
    const was = await watched.textContent();
    await page.getByTestId(c.knob).focus();
    await page.keyboard.press(c.key);
    await expect(watched, `${c.knob} moved nothing`).not.toHaveText(was ?? '');
    await expect(position, `${c.knob} advanced the deck`).toHaveText(before ?? '');
  }
});

test('M5\'s knobs write the address bar', async ({ page }) => {
  await page.goto('/lecture/m/m05/4');
  await page.getByTestId('T2.graph').selectOption('every');
  await expect(page).toHaveURL(/T2\.graph=every/);
  const shared = page.url();
  await page.goto('about:blank');
  await page.goto(shared);
  await expect(page.getByTestId('t2-belief-1-nb')).toHaveText('the other five');
});

test('M5\'s knobs cross from T2\'s first part to its second', async ({ page }) => {
  // Review Focus 8: a knob set on T2's first part reaches its second (D96).
  await page.goto('/lecture/m/m05/4?T2.w=1');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('readout-T2.limit-value')).toHaveText('0.5083');
});

test('the knobs cross from one part of a playground to the next, and stop at its end', async ({ page }) => {
  // X1 in three parts (D96): the release chosen on the first is the one the second and third
  // explain. A knob that reset on each step would put v2 back on the screen while the professor
  // talks about v1's leak.
  await page.goto('/lecture/m/m01/8');
  await page.getByTestId('X1.r').selectOption('sgb-v1');
  await page.getByTestId('X1.vs').selectOption('sgb-v2');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/\/lecture\/m\/m01\/9\?X1\.r=sgb-v1&X1\.vs=sgb-v2$/);
  await expect(page.getByTestId('x1-equality-test')).toContainText('4,844');

  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/\/lecture\/m\/m01\/10\?X1\.r=sgb-v1&X1\.vs=sgb-v2$/);
  await expect(page.getByTestId('x1-disjoint-a')).toContainText('validation drawn from the test pool');

  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/\/lecture\/m\/m01\/11$/);
});
});
