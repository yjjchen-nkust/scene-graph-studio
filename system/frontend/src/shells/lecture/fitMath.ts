import { useEffect, type RefObject } from 'react';

/** Below this the formula is too small to read from the back of a room; see the note below. */
export const MIN_MATH_SCALE = 0.55;

/** How much a block may exceed its box before it counts as clipped. One pixel is rounding. */
export const CLIP_TOLERANCE_PX = 1;

/**
 * How far a display formula runs past its box, in pixels.
 *
 * The inner `.katex` element's own `scrollWidth`, against the block's `clientWidth`. Two other
 * readings of the same geometry were tried first and both were wrong, in opposite directions:
 *
 * * `inner.getBoundingClientRect().width` is **clamped** to the container once the block
 *   scrolls, so a formula 163 px too wide measures as 0 too wide. The first version of this
 *   module and the check-8 assertion meant to cover it both read that number, so the fit scaled
 *   nothing, the test reported nothing, and the formula was still off the wall.
 * * `block.scrollWidth - block.clientWidth` **undercounts**, because display math is centred and
 *   a centred overflow spills equally to both sides while `scrollWidth` reports only the right.
 *   Scaling by that ratio converges from the wrong number and leaves 16 to 65 px clipped.
 *
 * Exported so the test measures what the implementation measures, rather than forming a second
 * opinion about the same geometry — which is exactly how the first two errors survived.
 */
export function overflowOf(block: HTMLElement): number {
  const inner = block.querySelector<HTMLElement>('.katex');
  if (!inner) return 0;
  return inner.scrollWidth - block.clientWidth;
}

/**
 * Shrink a display formula that is wider than the slide, rather than letting it be cut off.
 *
 * Found by check 8 at 1024×768: M04's steps 1, 2 and 3 overflow an XGA panel, the widest by
 * 163 px. KaTeX lays a formula out at a fixed size and does not reflow, so on a projector fitted
 * before about 2015 the right-hand side of three equations in the metrics module is simply not
 * on the wall — and the laptop driving it reports 1920×1080, so the author never sees it.
 *
 * The scale is applied as `font-size`, not `transform`. KaTeX's geometry is linear in its font
 * size, so the block reflows at the new size and its height is correct; a transform would leave
 * the original height behind as a gap and put the baseline where the prose does not expect it.
 *
 * **A formula that would have to go below `MIN_MATH_SCALE` is left at that floor and allowed to
 * scroll.** Shrinking without limit trades one unreadable slide for another, and a formula that
 * needs 55% of its natural size is a content problem — the equation wants splitting — which the
 * author should see rather than have hidden.
 */
export function fitDisplayMath(root: HTMLElement): void {
  for (const block of root.querySelectorAll<HTMLElement>('.katex-display')) {
    // Measure at natural size every time, and with no scroll container in the way: the previous
    // fit is not the starting point, or a sequence of resizes would ratchet the formula down and
    // never bring it back.
    block.style.fontSize = '';
    block.style.overflowX = '';

    const available = block.clientWidth;
    if (available === 0) continue;
    if (overflowOf(block) <= CLIP_TOLERANCE_PX) continue;

    let scale = 1;
    // Three passes. Font-size scaling is very nearly linear in KaTeX but not exactly — glyph
    // advances round to the pixel and a few atoms have minimum widths — so one pass leaves a
    // formula a percent or two over and still clipped. Each pass measures the result rather
    // than trusting the model, and stops as soon as it fits.
    for (let pass = 0; pass < 3; pass += 1) {
      const needed = available + overflowOf(block);
      if (needed <= available + CLIP_TOLERANCE_PX) break;
      scale = Math.max(MIN_MATH_SCALE, scale * (available / needed));
      block.style.fontSize = `${scale}em`;
      if (scale === MIN_MATH_SCALE) break;
    }

    // Only where the floor was not enough. A scroll container on a slide is an admission, not a
    // solution, and it is set last so it never hides a formula the scaling could have fitted.
    if (overflowOf(block) > CLIP_TOLERANCE_PX) block.style.overflowX = 'auto';
  }
}

/**
 * The same, re-run whenever the step changes, the window resizes, or the fonts arrive.
 *
 * **The font wait is not belt-and-braces; without it the fit is simply wrong.** KaTeX's WOFF2
 * files are bundled rather than fetched (NFR-1), but they are still decoded asynchronously, and
 * a formula measured against the fallback metrics is narrower than the one that gets painted.
 * M02's third display block measures 986 px before the maths fonts land and 1057 px after, so
 * the scale computed on mount left 65 px of it off the wall — which looked exactly like a fit
 * that was not running at all, and was diagnosed as one twice.
 */
export function useFitDisplayMath(ref: RefObject<HTMLElement | null>, key: unknown): void {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    let live = true;
    const fit = () => {
      if (live && root.isConnected) fitDisplayMath(root);
    };

    fit();
    // `document.fonts` is absent in jsdom and in a few older engines; the immediate fit above is
    // then the only one, which is the pre-existing behaviour rather than a crash.
    void document.fonts?.ready.then(fit);

    window.addEventListener('resize', fit);
    return () => {
      live = false;
      window.removeEventListener('resize', fit);
    };
  }, [ref, key]);
}
