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
    // Resolved by painting the colour, not by parsing its spelling.
    //
    // This read `/rgba?\((\d+),...)/` until 2026-09-20 and returned null for anything else, and
    // `painted` skips a row it cannot parse. Tailwind v4 emits `oklch()` for every one of its
    // colour utilities, so every element styled by a Tailwind class was silently dropped: on the
    // F1 step, 13 of 20 text rows, including all four readouts. The `palette.ts` content that
    // this test was written against is plain `rgb()` and was measured all along, which is why a
    // blind instrument kept reporting a pass. The floor assertion below did not catch it either,
    // because the 7 rows that survived cleared a floor of 3.
    //
    // A canvas resolves any syntax the browser accepts, current or future, and returns the alpha
    // the backdrop walk needs rather than a second regex for it.
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const ctx = probe.getContext('2d', { willReadFrequently: true })!;
    const parse = (value: string): [number, number, number, number] | null => {
      if (!value) return null;
      ctx.fillStyle = '#000';
      ctx.fillStyle = value;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
    };
    const channel = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const lum = ([r, g, b]: [number, number, number, number]) =>
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

    // The nearest ancestor that actually paints. A transparent background inherits what is
    // behind it, and measuring against `rgba(0,0,0,0)` would score every element 1:1. The alpha
    // now comes from the painted pixel, so `oklch(... / 50%)` is read as correctly as `rgba()`.
    const backdrop = (el: Element): [number, number, number, number] => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        const rgba = parse(getComputedStyle(node).backgroundColor);
        if (rgba && rgba[3] > 0) return rgba;
      }
      return [255, 255, 255, 1];
    };

    const out: Painted[] = [];
    const skipped: string[] = [];
    for (const el of document.querySelectorAll(sel)) {
      // Only the element that owns the words, so a wrapper is not scored for its children.
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!own) continue;
      const style = getComputedStyle(el);
      const fg = parse(style.color);
      if (!fg) {
        skipped.push(`${own.slice(0, 40)} :: ${style.color}`);
        continue;
      }
      const bg = backdrop(el);
      const [hi, lo] = lum(fg) >= lum(bg) ? [lum(fg), lum(bg)] : [lum(bg), lum(fg)];
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
      // this test visited index 1 and that was the mathematics; the renumbering moved it.
      for (const step of [2, 1, 3, 4]) {
        await page.goto(`/lecture/m/m00/${step}`);
        await expect(page.getByTestId('lecture-root')).toBeVisible();

        const { rows, skipped } = await painted(
          page,
          '[data-testid="lecture-root"] h1, [data-testid="lecture-root"] h2, ' +
            '[data-testid="lecture-root"] h3, [data-testid="lecture-root"] p, ' +
            '[data-testid="lecture-root"] li, [data-testid="lecture-root"] span, ' +
            '[data-testid="lecture-root"] td, [data-testid="lecture-root"] th',
        );

        // Nothing unread, before anything read is judged. The floor used to be
        // `toBeGreaterThan(3)`, which 7 surviving rows cleared while 13 were being dropped for a
        // colour syntax the parser did not know -- a green test over a quarter of the slide.
        // An instrument that cannot say what it failed to look at cannot be trusted to say the
        // rest passed.
        expect(
          skipped,
          `step ${step}: ${skipped.length} text elements whose colour could not be read: ` +
            `${JSON.stringify(skipped, null, 2)}`,
        ).toEqual([]);
        expect(rows.length, `step ${step}: nothing was measured`).toBeGreaterThan(3);
        const failures = rows.filter((row) => row.ratio < 7);
        expect(
          failures,
          `step ${step}, below 7:1 as painted: ${JSON.stringify(failures, null, 2)}`,
        ).toEqual([]);
      }
    });

    test('a playground is sized in the shell it is in, not in root pixels', async ({ page }) => {
      // Spec §4.2 puts the lecture shell at >= 24 px base. Tailwind's `text-sm` and `text-base`
      // are rem against the 16 px document root, not em against `lecture-root`, so the first
      // version of these three playgrounds rendered its readout labels and its NFR-2 provenance
      // notes at 14 px -- the smallest type in the corpus, on the numbers the playground exists
      // to show. Nothing else in the deck goes below 18 px.
      for (const step of [1, 3, 4]) {
        await page.goto(`/lecture/m/m00/${step}`);
        await expect(page.getByTestId('playground-frame')).toBeVisible();

        const small = await page.evaluate(() => {
          const frame = document.querySelector('[data-testid="playground-frame"]')!;
          const out: { text: string; px: number }[] = [];
          for (const el of frame.querySelectorAll('*')) {
            const own = [...el.childNodes]
              .filter((n) => n.nodeType === Node.TEXT_NODE)
              .map((n) => n.textContent ?? '')
              .join('')
              .trim();
            if (!own) continue;
            const px = Number.parseFloat(getComputedStyle(el).fontSize);
            if (px < 18) out.push({ text: own.slice(0, 30), px });
          }
          return out;
        });

        expect(
          small,
          `step ${step}: playground text below the deck's 18 px floor: ${JSON.stringify(small)}`,
        ).toEqual([]);
      }
    });

    test('a playground step fits the panel, with its controls reachable', async ({ page }) => {
      await page.goto('/lecture/m/m00/1');
      const controls = page.getByTestId('playground-controls');
      await expect(controls).toBeInViewport();

      // D71 accepted 25 of 92 slides overflowing an XGA panel. Controls above the visual is the
      // rule that keeps a playground off that list: the picture may be clipped, the knobs may not.
      const box = await controls.boundingBox();
      const height = page.viewportSize()?.height ?? 0;
      expect(box, 'controls have a box').not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(height);
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
