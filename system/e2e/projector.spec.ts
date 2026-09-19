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

/**
 * WCAG 2.1 against the colours the browser computed, measured inside the page.
 *
 * Written as a real function passed to `evaluate`, not as a string. The first draft passed the
 * source as a string, which Playwright evaluates as an expression: it returned the function
 * itself, serialised to `undefined`, and three tests failed with what looked like a contrast
 * problem in the application. The finding was in the instrument.
 */
async function painted(page: Page, selector: string): Promise<Painted[]> {
  return page.evaluate((sel) => {
    const parse = (value: string): [number, number, number] | null => {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
    };
    const channel = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const lum = ([r, g, b]: [number, number, number]) =>
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

    // The nearest ancestor that actually paints. A transparent background inherits what is
    // behind it, and measuring against `rgba(0,0,0,0)` would score every element 1:1.
    const backdrop = (el: Element): [number, number, number] => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        const value = getComputedStyle(node).backgroundColor;
        const alpha = /rgba\([^)]*,\s*([\d.]+)\)/.exec(value);
        const rgb = parse(value);
        if (rgb && (!alpha || Number(alpha[1]) > 0)) return rgb;
      }
      return [255, 255, 255];
    };

    const out: Painted[] = [];
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
      if (!fg) continue;
      const bg = backdrop(el);
      const [hi, lo] = lum(fg) >= lum(bg) ? [lum(fg), lum(bg)] : [lum(bg), lum(fg)];
      out.push({
        text: own.slice(0, 40),
        color: style.color,
        ratio: Number(((hi + 0.05) / (lo + 0.05)).toFixed(2)),
        px: Number.parseFloat(style.fontSize),
      });
    }
    return out;
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
      // M00 step 2 is the longest slide in the corpus: 1030 px past the bottom of an XGA panel.
      // The step scrolls inside the shell; the page does not, so the two things that say where
      // the lecture is do not scroll away with it.
      await page.goto('/lecture/m/m00/1');
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
      await page.goto('/lecture/m/m00/1');
      await expect(page.getByTestId('lecture-root')).toBeVisible();

      const measured = await painted(
        page,
        '[data-testid="lecture-root"] h1, [data-testid="lecture-root"] h2, ' +
          '[data-testid="lecture-root"] h3, [data-testid="lecture-root"] p, ' +
          '[data-testid="lecture-root"] li, [data-testid="lecture-root"] span, ' +
          '[data-testid="lecture-root"] td, [data-testid="lecture-root"] th',
      );

      expect(measured.length, 'nothing was measured, so nothing was checked').toBeGreaterThan(3);
      const failures = measured.filter((row) => row.ratio < 7);
      expect(
        failures,
        `below 7:1 as painted: ${JSON.stringify(failures, null, 2)}`,
      ).toEqual([]);
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
