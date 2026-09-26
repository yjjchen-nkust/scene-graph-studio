import { expect, test, type Page } from '@playwright/test';

/**
 * Design §6 check 8, second half: the rehearsal at projector resolutions.
 *
 * The keyboard walkthrough in `lecture.spec.ts` runs at 1920×1080 because that is what a laptop
 * driving a projector usually reports. **The projector usually does not.** A hall fitted before
 * about 2015 is XGA, 1024×768, and a WXGA panel is 1280×800; the laptop scales to it and the
 * slide the room sees is not the slide the author saw. These three sizes are the ones a
 * university lecture theatre actually presents at.
 *
 * What this file can check: that nothing overflows horizontally at any of them, that the base
 * type stays at 24 px, and — the part that was previously only a claim about a palette — that
 * the contrast of the text *as rendered* meets NFR-5's 7:1. `palette.ts` asserts the tokens;
 * this asserts what the browser actually painted, which is a different statement and the one the
 * room experiences.
 *
 * What it cannot check, and what is left for the author: a lit room, a dusty lens, a projector
 * whose gamma has drifted, and whether the person in the back row can read it. Screenshots are
 * written to `test-results/projector/` so that judgement has something to be made against.
 */

const SIZES = [
  { name: 'xga-1024x768', width: 1024, height: 768 },
  { name: 'wxga-1280x800', width: 1280, height: 800 },
  { name: 'fhd-1920x1080', width: 1920, height: 1080 },
] as const;

interface Painted {
  text: string;
  color: string;
  ratio: number;
  px: number;
}

interface Reading {
  rows: Painted[];
  /** Text-bearing elements whose colour could not be resolved. Must be empty. */
  skipped: string[];
}

/**
 * WCAG 2.1 against the colours the browser computed, measured inside the page.
 *
 * Written as a real function passed to `evaluate`, not as a string. The first draft passed the
 * source as a string, which Playwright evaluates as an expression: it returned the function
 * itself, serialised to `undefined`, and three tests failed with what looked like a contrast
 * problem in the application. The finding was in the instrument.
 */
async function painted(page: Page, selector: string): Promise<Reading> {
  return page.evaluate((sel) => {
    // Resolved by painting the colour, and a failure to resolve is detectable.
    //
    // Two starting values, not one. This primed `fillStyle` with `'#000'` and assigned the
    // candidate over it; canvas leaves `fillStyle` untouched when the assignment is invalid, so
    // an unresolvable colour came back as pure black -- which against a light slide is the
    // highest contrast obtainable, i.e. the reading that most certainly passes. The regex this
    // replaced failed loudly by returning null; its replacement failed silently by returning a
    // pass. Priming with two different colours and requiring them to agree makes the failure
    // visible again, and anything unresolvable goes to `skipped`.
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const ctx = probe.getContext('2d', { willReadFrequently: true })!;
    const paintOnce = (value: string, prime: string): [number, number, number, number] => {
      ctx.fillStyle = prime;
      ctx.fillStyle = value;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
    };
    const parse = (value: string): [number, number, number, number] | null => {
      if (!value) return null;
      const a = paintOnce(value, '#000000');
      const b = paintOnce(value, '#ffffff');
      return a.every((n, i) => n === b[i]) ? a : null;
    };

    const channel = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const lum = ([r, g, b]: [number, number, number, number]) =>
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

    /** Source-over, so a translucent ink is scored as the colour the eye receives. */
    const over = (
      fg: [number, number, number, number],
      bg: [number, number, number, number],
    ): [number, number, number, number] => [
      fg[0] * fg[3] + bg[0] * (1 - fg[3]),
      fg[1] * fg[3] + bg[1] * (1 - fg[3]),
      fg[2] * fg[3] + bg[2] * (1 - fg[3]),
      1,
    ];

    // The nearest ancestors that paint, composited. Alpha used to be read and then discarded:
    // an ink at 12% opacity scored as though it were opaque, which is the one case where the
    // painted result and the declared colour differ most.
    const backdrop = (el: Element): [number, number, number, number] => {
      const stack: [number, number, number, number][] = [];
      for (let node: Element | null = el; node; node = node.parentElement) {
        const rgba = parse(getComputedStyle(node).backgroundColor);
        if (rgba && rgba[3] > 0) {
          stack.push(rgba);
          if (rgba[3] === 1) break;
        }
      }
      let out: [number, number, number, number] = [255, 255, 255, 1];
      for (let i = stack.length - 1; i >= 0; i -= 1) out = over(stack[i]!, out);
      return out;
    };

    const rendered = (el: Element) => {
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) {
        return false;
      }
      const box = (el as HTMLElement).getBoundingClientRect();
      return box.width >= 1 && box.height >= 1;
    };

    const out: Painted[] = [];
    const skipped: string[] = [];
    const root = document.querySelector(sel);
    if (!root) return { rows: out, skipped: [`no element matches ${sel}`] };

    // Every descendant, not a list of tag names. The list was `h1,h2,h3,p,li,span,td,th`, and an
    // element outside it was neither measured nor reported -- 178 of them on the mathematics
    // step, including the four contract headings. A tag allowlist is a silent skip that the
    // `skipped` report cannot see, which is the defect this whole function was rewritten to
    // remove and which it kept in a second form.
    for (const el of root.querySelectorAll('*')) {
      // KaTeX renders a MathML copy of every formula for assistive technology and hides it from
      // paint. It is the same text twice, and it is not what the room sees.
      if (el.closest('.katex-mathml')) continue;
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!own) continue;
      if (!rendered(el)) continue;

      const style = getComputedStyle(el);
      const fg = parse(style.color);
      if (!fg) {
        skipped.push(`${own.slice(0, 40)} :: ${style.color}`);
        continue;
      }
      const bg = backdrop(el);
      const ink = over(fg, bg);
      const [hi, lo] = lum(ink) >= lum(bg) ? [lum(ink), lum(bg)] : [lum(bg), lum(ink)];
      out.push({
        text: own.slice(0, 40),
        color: style.color,
        ratio: Number(((hi + 0.05) / (lo + 0.05)).toFixed(2)),
        px: Number.parseFloat(style.fontSize),
      });
    }
    return { rows: out, skipped };
  }, selector);
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(overflow.doc, 'the document scrolls sideways').toBeLessThanOrEqual(0);
  expect(overflow.body, 'the body scrolls sideways').toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sgs:v1:lang', '"zh-TW"'));
});

for (const size of SIZES) {
  test.describe(`at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('the lecture fits the panel without scrolling sideways', async ({ page }) => {
      // M04 carries the heaviest mathematics in the corpus, so it is the widest content there is.
      for (const step of [0, 1, 2, 3]) {
        await page.goto(`/lecture/m/m04/${step}`);
        await expect(page.getByTestId('lecture-root')).toBeVisible();
        await noHorizontalOverflow(page);
      }
    });

    test('no formula is cut off by the edge of the panel', async ({ page }) => {
      // Check 8 found three of M04's equations running off an XGA panel, unseen because the
      // laptop driving the projector reports 1920x1080. `fitMath.ts` shrinks a display block to
      // fit; this asserts the result across every module that carries mathematics.
      const clipped: { module: string; step: number; over: number }[] = [];
      for (const moduleId of ['m02', 'm03', 'm04', 'm05', 'm06', 'm11']) {
        await page.goto(`/lecture/m/${moduleId}/0`);
        const total = Number((await page.getByTestId('position').innerText()).split('/')[1]!.trim());
        for (let step = 0; step < total; step += 1) {
          await page.goto(`/lecture/m/${moduleId}/${step}`);
          await expect(page.getByTestId('lecture-root')).toBeVisible();
          // The inner element's own content width against the block's box — the quantity
          // `fitMath.overflowOf` uses, and deliberately the same one. Two other readings were
          // tried: the inner bounding rectangle, which a scrolling block clamps to zero, and
          // the block's own scrollWidth, which halves a centred overflow. Both let this
          // assertion pass against a formula that was visibly cut off.
          const over = await page.evaluate(() =>
            [...document.querySelectorAll<HTMLElement>('.katex-display')]
              .map((block) => {
                const inner = block.querySelector('.katex');
                return inner ? (inner as HTMLElement).scrollWidth - block.clientWidth : 0;
              })
              .filter((n) => n > 1),
          );
          for (const n of over) clipped.push({ module: moduleId, step, over: n });
        }
      }
      expect(clipped, `formulas running past the panel: ${JSON.stringify(clipped)}`).toEqual([]);
    });

    test('the position and the clock stay on screen on a slide that is too long', async ({
      page,
    }) => {
      // M00's math step is the longest slide in the corpus: 1030 px past the bottom of an XGA
      // panel. The step scrolls inside the shell; the page does not, so the two things that say
      // where the lecture is do not scroll away with it.
      //
      // Index 2, not 1. The three playground steps added to M0 renumbered the deck, and this
      // test kept the old number. Measured at XGA, M0's seven steps overflow the panel by
      // 0, 146, 1030, 0, 0, 0 and 0 px: index 2 is the slide the 1030 above refers to, and
      // index 1 is now F1, whose visual is clipped at 46vh. The assertion passed at index 1
      // too, which is the problem with leaving it there -- an assertion about a slide too long
      // to fit, made against one that nearly does.
      await page.goto('/lecture/m/m00/2');
      await expect(page.getByTestId('lecture-root')).toBeVisible();

      const pageScroll = await page.evaluate(
        () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
      );
      expect(pageScroll, 'the whole page scrolls, taking the header with it').toBeLessThanOrEqual(4);

      await page.getByTestId('step').evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await expect(page.getByTestId('position')).toBeInViewport();
    });

    test('the base type stays at 24 px whatever the panel is', async ({ page }) => {
      await page.goto('/lecture/m/m00/0');
      await expect(page.getByTestId('lecture-root')).toHaveCSS('font-size', '24px');
    });

    test('every painted word meets NFR-5 on the contrast the browser computed', async ({ page }) => {
      // Four steps. Index 2 is the mathematics this was written against; 1, 3 and 4 are F1, F2
      // and F8, whose readouts, notices and status lines are a second palette on the same deck,
      // drawn from Tailwind's scale rather than from `palette.ts`. Before the playgrounds landed
      // this test visited index 1 and that was the mathematics; the renumbering moved it. M1's
      // three playgrounds (indices 2, 4, 6) joined the walk on 2026-09-26.
      //
      // A floor per step, measured rather than guessed: at XGA the walk reads 203 rows on the
      // mathematics step and 33, 24 and 17 on F1, F2 and F8, and 27, 34 and 52 on F6, F7
      // and X1 at every panel size (2026-09-26). `toBeGreaterThan(3)` was kept
      // here after the oklch finding with a comment explaining why it had failed to catch it,
      // which is a floor known to be inadequate left in place. These are set below the
      // measured counts so ordinary content edits do not trip them, and far enough above zero
      // that a walk collapsing to a handful of rows is reported rather than passed.
      const pages: { module: string; step: number; floor: number }[] = [
        { module: 'm00', step: 2, floor: 150 },
        { module: 'm00', step: 1, floor: 25 },
        { module: 'm00', step: 3, floor: 18 },
        { module: 'm00', step: 4, floor: 12 },
        { module: 'm01', step: 2, floor: 20 },
        { module: 'm01', step: 4, floor: 25 },
        { module: 'm01', step: 6, floor: 39 },
      ];
      for (const { module, step, floor } of pages) {
        await page.goto(`/lecture/m/${module}/${step}`);
        await expect(page.getByTestId('lecture-root')).toBeVisible();

        const { rows, skipped } = await painted(page, '[data-testid="lecture-root"]');

        // Nothing unread, before anything read is judged. The floor used to be
        // `toBeGreaterThan(3)`, which 7 surviving rows cleared while 13 were being dropped for a
        // colour syntax the parser did not know -- a green test over a quarter of the slide.
        // An instrument that cannot say what it failed to look at cannot be trusted to say the
        // rest passed.
        expect(
          skipped,
          `${module}/${step}: ${skipped.length} text elements whose colour could not be read: ` +
            `${JSON.stringify(skipped, null, 2)}`,
        ).toEqual([]);
        expect(
          rows.length,
          `${module}/${step}: ${rows.length} rows measured, fewer than the ${floor} this step ` +
            `carries -- the walk is not reaching the slide`,
        ).toBeGreaterThanOrEqual(floor);
        const failures = rows.filter((row) => row.ratio < 7);
        expect(
          failures,
          `${module}/${step}, below 7:1 as painted: ${JSON.stringify(failures, null, 2)}`,
        ).toEqual([]);
      }
    });

    test('no word on a slide falls below the deck’s 18 px floor', async ({ page }) => {
      // Spec §4.2 puts the lecture shell at >= 24 px base. Two separate defects lived under
      // that: Tailwind's `text-sm`/`text-base` are rem against the 16 px document root rather
      // than em against `lecture-root`, which rendered the playgrounds' readout labels at 14 px;
      // and the four SRS §11.2 contract headings were `text-xs`, 12 px, on every mathematics
      // step in the corpus. The first was caught by an earlier version of this test. The second
      // was not, because that version scoped itself to `[data-testid="playground-frame"]` -- a
      // floor test that cannot see the element that breaks the floor.
      //
      // So: the whole slide, every descendant. KaTeX's internals are excluded because the
      // mathematics is sized by KaTeX and then scaled by `fitMath.ts`, which is a different
      // mechanism with its own test above; its struts and spacers carry 1 px text that is not
      // read by anyone.
      for (const [module, step] of [
        ...[0, 1, 2, 3, 4, 5, 6].map((s) => ['m00', s] as const),
        ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((s) => ['m01', s] as const),
      ]) {
        await page.goto(`/lecture/m/${module}/${step}`);
        await expect(page.getByTestId('lecture-root')).toBeVisible();

        const small = await page.evaluate(() => {
          const root = document.querySelector('[data-testid="lecture-root"]')!;
          const out: { text: string; px: number }[] = [];
          for (const el of root.querySelectorAll('*')) {
            if (el.closest('.katex') || el.closest('.katex-mathml')) continue;
            const own = [...el.childNodes]
              .filter((n) => n.nodeType === Node.TEXT_NODE)
              .map((n) => n.textContent ?? '')
              .join('')
              .trim();
            if (!own) continue;
            const st = getComputedStyle(el);
            if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) {
              continue;
            }
            const box = (el as HTMLElement).getBoundingClientRect();
            if (box.width < 1 || box.height < 1) continue;
            const px = Number.parseFloat(st.fontSize);
            if (px < 18) out.push({ text: own.slice(0, 30), px });
          }
          return out;
        });

        expect(
          small,
          `${module} step ${step}: text below the deck's 18 px floor: ${JSON.stringify(small)}`,
        ).toEqual([]);
      }
    });

    test('a playground step fits the panel, with its controls reachable', async ({ page }) => {
      // D71 accepted 25 of the then 92 slides overflowing an XGA panel (the corpus is 98 now; the
      // six playground steps are not in that denominator). Controls above the visual is the rule
      // that keeps a playground off that list: the picture may be clipped, the knobs may not.
      for (const where of ['m00/1', 'm00/3', 'm00/4', 'm01/2', 'm01/4', 'm01/6']) {
        await page.goto(`/lecture/m/${where}`);
        const controls = page.getByTestId('playground-controls');
        await expect(controls, where).toBeInViewport();
        const box = await controls.boundingBox();
        const height = page.viewportSize()?.height ?? 0;
        expect(box, `${where}: controls have a box`).not.toBeNull();
        expect(box!.y + box!.height, `${where}: controls end below the panel`).toBeLessThanOrEqual(height);
      }
    });

    test('capture the slide for the author to judge against a real room', async ({ page }) => {
      await page.goto('/lecture/m/m04/1');
      await expect(page.getByTestId('lecture-root')).toBeVisible();
      await page.screenshot({
        path: `test-results/projector/${size.name}-lecture.png`,
        fullPage: false,
      });

      await page.goto('/lecture/notes');
      await page.screenshot({ path: `test-results/projector/${size.name}-notes.png` });
    });
  });
}
