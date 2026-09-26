/**
 * What F3 is built on, named once for the component, its tests and the golden cases.
 *
 * Object 3 of `ph-001` is `box`, 90 x 70 at (250, 240). It is the one chosen because λ in steps
 * of 0.1 gives whole-pixel sizes for 90 and 70, and because the prediction stays inside the
 * 640 x 480 photograph at every setting of the knobs below.
 */
export const F3_FRAME = 'ph-001';
export const F3_OBJECT = 3;

/**
 * Xu et al. 2017, arXiv 1701.02426v2, §4, "Setup", item 3 (p. 5): "An object is considered to be
 * correctly detected if it has at least 0.5 IoU overlap with the ground-truth box."
 *
 * The one literal F3 carries, labelled with this origin on screen, as F1's two |P| presets are.
 */
export const XU_TAU = 0.5;

/** [min, max, step] of each knob. τ's range is L2's. */
export const F3_RANGES = {
  dx: [-120, 120, 2],
  dy: [-100, 100, 2],
  lambda: [0.5, 2, 0.1],
  tau: [0.05, 0.95, 0.05],
} as const;
