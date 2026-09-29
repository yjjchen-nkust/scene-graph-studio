/**
 * A `#n` badge as `PhotoMarks` draws one, in CSS pixels at the lecture's 24 px type: 0.75em mono
 * is 10.8 px a character, with 4 px of padding and the 1 px ring on each side, and one 22.5 px
 * line with its ring above and below. `#6` measured 27.8 × 22.5 px drawn, the ring being a
 * shadow outside that box, so these figures err on the side of room.
 */
export const BADGE_PX = { char: 10.8, pad: 10, line: 24.5 } as const;

/**
 * D-T part 1's photograph at 1024×768, the narrowest the projector sizes draw it, in CSS pixels
 * (measured; it is 398 px at 1280×800 and 538 px at 1920×1080). A badge is the same size on every
 * panel, so it is largest against the frame here, and a placement clear here is clear on all three.
 */
export const NARROWEST_PHOTO_PX = 374;

/** A badge of `chars` characters in the frame's own pixels, on a photograph drawn `photoPx` wide. */
export function badgeSize(frameWidth: number, chars: number, photoPx: number = NARROWEST_PHOTO_PX) {
  const scale = frameWidth / photoPx;
  return { w: (chars * BADGE_PX.char + BADGE_PX.pad) * scale, h: BADGE_PX.line * scale };
}
