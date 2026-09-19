import type { VerdictKind } from 'sgg-metrics';

export interface VerdictStyle {
  stroke: string;
  dash: string; // SVG stroke-dasharray; '' is solid
  width: number;
  marker: 'filled' | 'open' | 'hollow';
  labelKey: string; // i18n key for the legend
}

/**
 * The four verdicts, styled once.
 *
 * NFR-5: hue is never the only channel. Dash pattern, stroke width and marker shape each carry
 * the same distinction, so the diff survives a projector, a colour-blind reader and a greyscale
 * printout. The test asserts that the non-colour channels alone separate all four.
 *
 * The split these encode is the whole pedagogical point: a prediction can fail classification or
 * localization independently, and `localization` exists precisely so a right predicate on a badly
 * placed box does not look like a wrong predicate. That distinction is what the three evaluation
 * protocols exist to isolate.
 *
 * No component hard-codes a colour. Both graph views and the legend read this map, so changing a
 * hue here changes it everywhere, and a component that invents its own is a bug the legend test
 * will not catch — which is why the review rule is: colours come from here or not at all.
 */
export const VERDICT_STYLE: Record<VerdictKind, VerdictStyle> = {
  match: { stroke: '#1b7f4b', dash: '', width: 2, marker: 'filled', labelKey: 'diff.match' },
  spurious: { stroke: '#b42318', dash: '', width: 4, marker: 'open', labelKey: 'diff.spurious' },
  missed: { stroke: '#667085', dash: '6 4', width: 2, marker: 'open', labelKey: 'diff.missed' },
  localization: {
    stroke: '#b54708',
    dash: '2 3',
    width: 3,
    marker: 'hollow',
    labelKey: 'diff.localization',
  },
};

export const VERDICT_ORDER: VerdictKind[] = ['match', 'spurious', 'missed', 'localization'];
