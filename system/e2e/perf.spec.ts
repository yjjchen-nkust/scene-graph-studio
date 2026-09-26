import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * NFR-8, measured — the one non-functional requirement that had no enforcer.
 *
 * `docs/INDEX.md` §3 named an enforcing artefact for NFR-1 through NFR-7 and left NFR-8's cell
 * blank. The requirement states three things:
 *
 *   1. cold start under ten seconds;
 *   2. lab interaction under 100 ms;
 *   3. live RelTR inference displays a measured estimate before it begins.
 *
 * None of the three was asserted anywhere. The only timing assertion in the whole suite was
 * `/api/health` under 50 ms, which is a different claim about a different component. A project
 * that refuses an unsourced number in `content/` was carrying three unmeasured numbers in its
 * own requirements table, which is the defect D54 already named once: a figure written down
 * reads as a measurement and is not one.
 *
 * **Run it through `npm run check:perf`, not `playwright test`.** The harness starts a backend,
 * because four of the eight labs fetch a frame and a lab showing its failure state cannot be
 * timed. `playwright.config.ts` excludes this file from the default run for that reason.
 *
 * ## What each number is, exactly
 *
 * **Cold start** is measured from the navigation's time origin to the moment the route's first
 * meaningful element is in the document, in a browser context created for that one route — a new
 * context has an empty HTTP cache, empty storage and no warmed module graph, which is what makes
 * it cold. The measurement is taken from `performance.now()` inside the page, so it is the
 * page's own clock and not the runner's. Playwright's selector polling inflates it by up to one
 * poll interval; that inflation is conservative, it can only push a number towards the budget,
 * and at a ten-second budget it does not matter.
 *
 * What this cannot measure is the lecture theatre's machine. It measures the application: the
 * 3.5 MB bundle's transfer from localhost, its parse, its execute and its first paint. A slower
 * disk and a slower CPU are the author's to check against D-02's weaker ship target, and §8 of
 * `docs/VERIFICATION.md` says so.
 *
 * **Interaction** is input to next paint. The event is dispatched inside the page, then two
 * animation frames are awaited: the first callback runs before the current frame is painted, the
 * second after it, so the elapsed time spans the work and the paint that showed it. This is the
 * quantity a person in the room experiences, and it is not the same as React's render time.
 *
 * Every interaction also asserts that the readout it watches actually changed. Without that, an
 * interaction that silently did nothing would return a very good number — the instrument would
 * be measuring an empty frame and reporting it as speed. That is exactly the trap the contrast
 * check fell into (`projector.spec.ts`), and the guard is the same one.
 */

/** Budgets, from SRS NFR-8. Not tuned to what was measured; if one is missed, that is a finding. */
const COLD_START_MS = 10_000;
const INTERACTION_MS = 100;

/** Where the numbers are written, so a failure prints them rather than only a verdict. */
const measured: string[] = [];

test.afterAll(() => {
  if (measured.length) console.log(`\nNFR-8, measured:\n${measured.map((l) => `  ${l}`).join('\n')}`);
});

// ---------------------------------------------------------------------------------------------
// 1. Cold start
// ---------------------------------------------------------------------------------------------

/** The routes a lecture actually opens on, each with the element that means "it is on screen". */
const ENTRY_ROUTES = [
  { path: '/', ready: '[data-testid="module-index"]', what: 'the index' },
  { path: '/lecture/m/m00/0', ready: '[data-testid="lecture-root"]', what: 'the lecture shell' },
  { path: '/m/m00', ready: '[data-step-id]', what: 'the study column' },
  { path: '/map', ready: '[data-testid="visible-count"]', what: 'the field map' },
  { path: '/leaderboards', ready: '[data-testid^="board-"]', what: 'the leaderboards' },
] as const;

/**
 * One route, in a context that has never loaded this application.
 *
 * A fresh context per route rather than a fresh page: a page reuses the context's HTTP cache, so
 * the second route in a loop would be measuring a warm bundle and calling it a cold start.
 */
async function coldStart(browser: Browser, path: string, ready: string): Promise<number> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(path);
    await page.waitForSelector(ready, { state: 'attached', timeout: COLD_START_MS * 3 });
    return page.evaluate(() => performance.now());
  } finally {
    await context.close();
  }
}

for (const route of ENTRY_ROUTES) {
  test(`cold start: ${route.what} is on screen inside the budget`, async ({ browser }) => {
    const ms = await coldStart(browser, route.path, route.ready);
    measured.push(`cold start  ${route.path.padEnd(22)} ${ms.toFixed(0).padStart(6)} ms`);
    expect(ms, `${route.path} took ${ms.toFixed(0)} ms to first paint`).toBeLessThan(COLD_START_MS);
  });
}

// ---------------------------------------------------------------------------------------------
// 2. Lab interaction
// ---------------------------------------------------------------------------------------------

type Act =
  | { kind: 'click'; testid: string }
  | { kind: 'set'; testid: string; value: string };

interface LabCase {
  labId: string;
  /**
   * Everything the student has already done when the measured interaction happens.
   *
   * L1's button is disabled until a subject, an object and a predicate are chosen, so measuring
   * the click without them measures a disabled button — which the change guard reported as
   * `1:0 stayed 1:0`. The setup is not timed; only the act that follows it is.
   */
  setup?: (page: Page) => Promise<void>;
  /** What the student does. */
  act: Act;
  /** A selector whose rendered text must differ afterwards, or nothing was measured. */
  readout: string;
  /** Present only when the lab needs a frame the backend serves. */
  needsBackend?: boolean;
  why: string;
}

/**
 * One characteristic interaction per lab, and the reason three labs are absent.
 *
 * L4 and L5 are absent because their button starts a request — a model inference and a VLM turn.
 * Those are not local interactions and NFR-8's third clause governs them separately; timing a
 * fetch here would be filing a network measurement under a rendering budget. L6 is absent
 * because it has no control at all: it renders one comparison from the URL and nothing in it
 * moves, which is the point of the lab.
 */
const LAB_CASES: LabCase[] = [
  {
    labId: 'L1',
    setup: async (page) => {
      // Through the URL, which contracts §2.2 makes the lab's only state: a subject, an object
      // and a predicate are exactly what a shared L1 link carries, so arriving with them set is
      // a state a student reaches by opening the professor's link.
      //
      // Not by clicking the two boxes, although that works now (D75, and the case below asserts
      // it). Arriving with the pair already set keeps the measured act to the one click being
      // timed, rather than to a click preceded by two more and a select.
      const ids = await page
        .locator('[data-testid^="box-"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-object-id') ?? '').filter(Boolean));
      const predicate = await page
        .locator('[data-testid="predicate"] option')
        .nth(1)
        .getAttribute('value');
      expect(ids.length, 'L1 rendered fewer than two boxes, so no triplet can be built')
        .toBeGreaterThan(1);
      expect(predicate, 'L1 offered no predicate to choose').toBeTruthy();
      await page.goto(`/lab/L1?s=${ids[0]}&o=${ids[1]}&p=${encodeURIComponent(predicate ?? '')}`);
      await expect(page.getByTestId('lab-pending')).toHaveCount(0, { timeout: 30_000 });
    },
    act: { kind: 'click', testid: 'add' },
    readout: '[data-testid="built-count"]',
    needsBackend: true,
    why: 'adding a triplet re-scores the submission',
  },
  {
    labId: 'L2',
    act: { kind: 'set', testid: 'k', value: '73' },
    readout: '[data-testid="metric-R"], [data-testid="metric-mR"]',
    why: 'moving K re-runs all four metrics over the fixture',
  },
  {
    labId: 'L3',
    act: { kind: 'set', testid: 'lambda', value: '1' },
    // `blended`, not `gap`. The identity panel is evaluated at lambda = 0 on purpose — it is the
    // frequency prior's own gap — so it does not move when the slider does, and the first draft
    // of this case watched it and was told by the guard that it had measured nothing. The lab was
    // right and the instrument was wrong, which is the failure this guard exists to produce.
    readout: '[data-testid="blended"]',
    why: 'moving lambda re-scores the blended prediction',
  },
  {
    labId: 'L7',
    act: { kind: 'set', testid: 'caption', value: 'the hand places the beam on the workbench' },
    readout: '[data-testid="idle"], [data-testid^="node-"]',
    why: 'the caption is parsed to a graph on every keystroke',
  },
  {
    labId: 'L8',
    act: { kind: 'click', testid: 'delete' },
    readout: '[data-testid="count-deletions"]',
    needsBackend: true,
    why: 'a deletion re-counts the corrections',
  },
];

/**
 * Dispatch the act inside the page and return the time to the next painted frame.
 *
 * A React-controlled input ignores a plain `el.value = x`: React caches the last value it wrote
 * on the node and skips the change as a no-op. The prototype's own setter is what bypasses that
 * cache, which is why the descriptor is fetched rather than the property assigned.
 */
async function inputToPaint(
  page: Page,
  act: Act,
  readout: string,
): Promise<{ ms: number; floor: number; before: string; after: string }> {
  return page.evaluate(
    async ({ act, readout }) => {
      const read = () => {
        const nodes = [...document.querySelectorAll<HTMLElement>(readout)];
        return `${nodes.length}:${nodes.map((n) => n.innerText.trim()).join('|')}`;
      };

      const el = document.querySelector<HTMLElement>(`[data-testid="${act.testid}"]`);
      if (!el) throw new Error(`no [data-testid="${act.testid}"] on this page`);

      const paint = () =>
        new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      // Settle whatever the previous frame was still doing, so the clock starts on a quiet page.
      await paint();

      // Sampled after the settle, not before it. Taken first, `before` could capture a frame the
      // navigation had not finished painting, and the change guard would then read that paint as
      // the act's own work.
      const before = read();

      // Calibrate. Two animation frames cost two frame intervals whether or not anything happened
      // in them, so at 60 Hz this instrument cannot report less than about 33 ms and a lab that
      // did its work in one millisecond would still be recorded at the cadence of the display.
      // Measuring the empty wait on this page, in this frame, is what separates the two: `ms`
      // bounds what the room experiences, `ms - floor` is what the application cost.
      const c0 = performance.now();
      await paint();
      const floor = performance.now() - c0;

      const t0 = performance.now();
      if (act.kind === 'click') {
        el.click();
      } else {
        const proto =
          el instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : el instanceof HTMLSelectElement
              ? HTMLSelectElement.prototype
              : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (!setter) throw new Error('no value setter on the element prototype');
        setter.call(el, act.value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await paint();
      const ms = performance.now() - t0;

      return { ms, floor, before, after: read() };
    },
    { act, readout },
  );
}

/**
 * What the two samples support saying, which is not always a number.
 *
 * `ms - floor` subtracts two samples of the same two-animation-frame quantity, so when the work
 * is small the difference is noise around zero and is as often negative as positive. It was
 * printed as `Math.max(0, ms - floor)`, and every one of the recorded playground figures was in
 * fact negative -- a clamp turning an unresolvable quantity into an apparent measurement of
 * exactly zero, which is D54's defect in a new place. If the difference does not clear the
 * sampling noise, say so instead of quoting it.
 */
function workReport(ms: number, floor: number): string {
  const delta = ms - floor;
  if (delta <= 0) return `below the ${floor.toFixed(1)} ms two-frame floor`;
  return `${delta.toFixed(1)} ms above the ${floor.toFixed(1)} ms two-frame floor`;
}

test.describe('lab interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sgs:v1:lang', '"zh-TW"'));
  });

  for (const c of LAB_CASES) {
    test(`${c.labId}: ${c.why}, inside the budget`, async ({ page }) => {
      await page.goto(`/lab/${c.labId}`);
      await expect(page.getByTestId('lab-root')).toHaveAttribute('data-lab', c.labId);

      // Wait for the lab to settle before looking for its control. Four of the eight fetch a
      // frame, and while `lab-pending` is up the control is not in the document at all — the
      // first run of this file reported `no [data-testid="delete"] on this page` for L8, which
      // read like a missing element and was a race.
      await expect(page.getByTestId('lab-pending')).toHaveCount(0, { timeout: 30_000 });

      // A lab whose slice was never unpacked renders its failure sentence. That is a correct
      // application state and an absent measurement, and the two must not be confused: the test
      // says which, and the run as a whole fails if it happens to every backed lab.
      if (await page.getByTestId('lab-failure').isVisible().catch(() => false)) {
        const sentence = await page.getByTestId('lab-failure').innerText();
        measured.push(`interaction ${c.labId.padEnd(22)} not measured — ${sentence.slice(0, 60)}`);
        test.skip(Boolean(c.needsBackend), `${c.labId} has no data on this machine: ${sentence}`);
      }

      await expect(page.getByTestId(c.act.testid).first()).toBeAttached({ timeout: 30_000 });

      if (c.setup) await c.setup(page);

      // A disabled control accepts a click and does nothing, which the change guard would report
      // as "painted no change" without saying why. Assert the precondition the setup was for.
      await expect(page.getByTestId(c.act.testid).first()).toBeEnabled();

      const { ms, floor, before, after } = await inputToPaint(page, c.act, c.readout);

      expect(
        after,
        `${c.labId}: the interaction painted no change, so the ${ms.toFixed(1)} ms is the time ` +
          `to do nothing. Readout was ${before} and stayed ${after}.`,
      ).not.toBe(before);

      measured.push(
        `interaction ${c.labId.padEnd(22)} ${ms.toFixed(1).padStart(6)} ms ` +
          `(work: ${workReport(ms, floor)})`,
      );
      expect(ms, `${c.labId} took ${ms.toFixed(1)} ms from input to paint`).toBeLessThan(
        INTERACTION_MS,
      );
    });
  }

  test('every lab that does not need a backend was actually measured', () => {
    // `>= 3` was satisfied by exactly the three cases that can never skip (L2, L3, L7), so the
    // floor held on a run where both backed labs skipped and nothing about the backend was
    // reported. The unbacked cases are named, and the backed ones are counted separately so a
    // run that measured none of them says so rather than passing quietly.
    const timed = measured.filter((l) => l.startsWith('interaction') && !l.includes('not measured'));
    const unbacked = LAB_CASES.filter((c) => !c.needsBackend).map((c) => c.labId);
    for (const labId of unbacked) {
      expect(
        timed.some((l) => l.includes(labId)),
        `${labId} needs no backend and was not measured`,
      ).toBe(true);
    }
    const backed = LAB_CASES.filter((c) => c.needsBackend).map((c) => c.labId);
    const backedTimed = backed.filter((labId) => timed.some((l) => l.includes(labId)));
    console.log(`  labs needing a backend measured: ${backedTimed.length}/${backed.length}`);
  });
});

// ---------------------------------------------------------------------------------------------
// 2b. Playground interaction
// ---------------------------------------------------------------------------------------------

/**
 * The same budget, on the three components that sit inside a lecture step rather than a lab
 * route.
 *
 * Added 2026-09-20 with the M0 playgrounds. NFR-8's second clause bounds input-to-paint at
 * 100 ms and says nothing about which route the input lands on, so `check:perf` passing while
 * measuring only `/lab/*` left the three newest interactive components unmeasured -- and these
 * are the ones a professor turns in front of a room, where the lab is something a student opens
 * alone.
 *
 * No backend: a playground imports its slice at build time, so unlike four of the five labs
 * above there is no `lab-pending` to wait out and no failure sentence to skip on.
 */
const PLAYGROUND_CASES: {
  module: string; kp: string; step: number; act: Act; readout: string; why: string;
}[] = [
  {
    module: 'm00',
    kp: 'F1',
    step: 1,
    act: { kind: 'set', testid: 'F1.density', value: '0.5' },
    readout: '[data-testid="playground-frame"] [data-testid^="readout-"]',
    why: 'moving the density slider re-cuts the edge set and re-divides the share',
  },
  {
    module: 'm00',
    kp: 'F2',
    step: 3,
    act: { kind: 'click', testid: 'F2.directed' },
    readout: '[data-testid="playground-frame"] [data-testid^="readout-"]',
    why: 'discarding direction halves the candidate space',
  },
  {
    module: 'm00',
    kp: 'F8',
    step: 4,
    act: { kind: 'click', testid: 'F8.swap' },
    // Not a readout: F8's only readout is |E| for the frame, which a swap does not move. The
    // sentence and the status are what the swap changes, and a case watching the wrong element
    // is reported by the change guard as having measured nothing.
    readout: '[data-testid="f8-sentence"], [data-testid="f8-status"]',
    why: 'swapping subject and object re-reads the triplet against E',
  },
  {
    module: 'm01',
    kp: 'F6',
    step: 2,
    act: { kind: 'click', testid: 'F6.mp' },
    readout: '[data-testid="playground-frame"] [data-testid^="readout-"]',
    why: 'merging the four predicates recounts the classes',
  },
  {
    module: 'm01',
    kp: 'F7',
    step: 4,
    act: { kind: 'set', testid: 'F7.s', value: '2' },
    readout: '[data-testid="playground-frame"] [data-testid^="readout-"]',
    why: 'moving s re-divides the head share',
  },
  {
    module: 'm01',
    kp: 'X1',
    step: 6,
    act: { kind: 'set', testid: 'X1.r', value: 'sgb-v1' },
    readout: '[data-testid^="x1-"]',
    why: 'choosing another release re-reads every figure and every difference',
  },
];

test.describe('playground interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sgs:v1:lang', '"zh-TW"'));
  });

  for (const c of PLAYGROUND_CASES) {
    test(`${c.kp}: ${c.why}, inside the budget`, async ({ page }) => {
      await page.goto(`/lecture/m/${c.module}/${c.step}`);
      await expect(page.getByTestId('playground-frame')).toBeVisible();
      await expect(page.getByTestId(c.act.testid)).toBeEnabled();

      const { ms, floor, before, after } = await inputToPaint(page, c.act, c.readout);

      expect(
        after,
        `${c.kp}: the interaction painted no change, so the ${ms.toFixed(1)} ms is the time to ` +
          `do nothing. Readout was ${before} and stayed ${after}.`,
      ).not.toBe(before);

      measured.push(
        `playground   ${c.kp.padEnd(22)} ${ms.toFixed(1).padStart(6)} ms ` +
          `(work: ${workReport(ms, floor)})`,
      );
      expect(ms, `${c.kp} took ${ms.toFixed(1)} ms from input to paint`).toBeLessThan(
        INTERACTION_MS,
      );
    });
  }

  test('all six playgrounds were actually measured', () => {
    const timed = measured.filter((l) => l.startsWith('playground'));
    expect(
      timed.length,
      `only ${timed.length} playgrounds were timed; M0 and M1 carry six`,
    ).toBe(6);
  });
});

// ---------------------------------------------------------------------------------------------
// 3. Selecting a box by clicking inside it — D75
// ---------------------------------------------------------------------------------------------

/**
 * Not a performance claim, and here because this is the only e2e file that runs with a backend,
 * which L1 needs.
 *
 * `ImageOverlay.test.tsx` asserts the same behaviour in jsdom with a stubbed client rect, and it
 * catches every mutation of the rule. What it cannot prove is the part that was actually broken:
 * that a real browser's SVG hit testing lets a click in the middle of a `fill="none"` box reach
 * the handler at all. jsdom has no hit testing, so it would pass either way.
 */
test.describe('selecting an object', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sgs:v1:lang', '"zh-TW"'));
  });

  test('a click in the middle of a box selects it, not only one on its outline', async ({
    page,
  }) => {
    await page.goto('/lab/L1');
    await expect(page.getByTestId('lab-root')).toHaveAttribute('data-lab', 'L1');
    await expect(page.getByTestId('lab-pending')).toHaveCount(0, { timeout: 30_000 });

    if (await page.getByTestId('lab-failure').isVisible().catch(() => false)) {
      test.skip(true, await page.getByTestId('lab-failure').innerText());
    }

    const boxes = page.locator('[data-testid^="box-"]');
    await expect(boxes.first()).toBeAttached({ timeout: 30_000 });

    // The centre of the first box, in client pixels, clicked on the svg rather than on the rect
    // — which is what a person does and what the outline-only hit test used to swallow.
    const box = await boxes.first().boundingBox();
    expect(box, 'the first box has no layout, so there is nothing to click').not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

    // Something is now the subject. Which object it is depends on the frame's own geometry —
    // the smallest box containing that point — so the assertion is that a role was assigned,
    // not which id got it.
    await expect(page.locator('[data-object-id][data-role="subject"]')).toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------------------------
// 4. The estimate before the inference
// ---------------------------------------------------------------------------------------------

test('L4 states each model’s per-image cost before any inference is started', async ({
  page,
}) => {
  // NFR-8's third clause. The student decides whether to wait, so the number has to be on screen
  // before the button is pressed, and a model with no measurement has to say that rather than
  // leave the line blank — an absent figure and an unmeasured one look identical otherwise.
  await page.addInitScript(() => localStorage.setItem('sgs:v1:lang', '"zh-TW"'));
  await page.goto('/lab/L4');
  await expect(page.getByTestId('lab-root')).toHaveAttribute('data-lab', 'L4');

  if (await page.getByTestId('lab-failure').isVisible().catch(() => false)) {
    test.skip(true, await page.getByTestId('lab-failure').innerText());
  }

  // One request per model, so the columns arrive after the first paint. Waiting for the first
  // line is not the same as asserting there is one: if none ever arrives the wait times out and
  // the next assertion still has to hold.
  await page
    .locator('[data-testid^="latency-"]')
    .first()
    .waitFor({ state: 'attached', timeout: 30_000 })
    .catch(() => undefined);

  const lines = await page.locator('[data-testid^="latency-"]').all();
  expect(lines.length, 'L4 rendered no columns, so no estimate was checked').toBeGreaterThan(0);

  for (const line of lines) {
    const testid = (await line.getAttribute('data-testid')) ?? '';
    const text = (await line.innerText()).trim();
    expect(text, `${testid} is blank`).not.toBe('');
    measured.push(`estimate    ${testid.replace('latency-', '').padEnd(22)} ${text}`);
  }

  // And it is there before the button, not after it: every column that offers a live run has its
  // estimate rendered while the button is still unpressed.
  for (const button of await page.locator('[data-testid^="infer-"]').all()) {
    const model = ((await button.getAttribute('data-testid')) ?? '').replace('infer-', '');
    await expect(page.getByTestId(`latency-${model}`)).toBeVisible();
  }
});
