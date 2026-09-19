import type { Css, StylesheetStyle } from 'cytoscape';
import type { VerdictStyle } from './palette';
import { VERDICT_ORDER, VERDICT_STYLE } from './palette';

/**
 * The three marker kinds in Cytoscape's vocabulary.
 *
 * `palette.ts` names the kinds and stays free of any library's terms, because both the SVG
 * overlay and this view read it and neither should have to speak the other's dialect. The
 * translation lives here, once, and the three shapes stay distinguishable in greyscale: solid
 * triangle, hollow triangle, triangle with a crossbar (NFR-5).
 *
 * Typing them as `Css.ArrowShape` rather than `string` is what makes a misspelt shape a
 * compile error. Cytoscape itself accepts one in silence and falls back to the default.
 */
const ARROW: Record<VerdictStyle['marker'], { shape: Css.ArrowShape; fill: Css.ArrowFill }> = {
  filled: { shape: 'triangle', fill: 'filled' },
  open: { shape: 'triangle', fill: 'hollow' },
  hollow: { shape: 'triangle-tee', fill: 'filled' },
};

/**
 * The stylesheet, derived from `VERDICT_STYLE` rather than written alongside it.
 *
 * A second hand-kept copy of the four colours is the defect this shape exists to make
 * impossible: change a hue in the palette and the graph, the overlay and the legend all move
 * together, because none of them holds a literal.
 */
export function cyStylesheet(): StylesheetStyle[] {
  const sheet: StylesheetStyle[] = [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'background-color': '#e2e8f0',
        'border-color': '#475569',
        'border-width': 1,
        shape: 'round-rectangle',
        width: 'label',
        height: 'label',
        padding: '8px',
        'font-size': 12,
        'text-valign': 'center',
        'text-halign': 'center',
        color: '#0f172a',
      },
    },
    {
      // A ghost node is ground truth the prediction never proposed. It is drawn as an outline
      // so it cannot be mistaken for something the model produced.
      selector: 'node[?ghost]',
      style: {
        'background-opacity': 0,
        'border-style': 'dashed',
        'border-color': VERDICT_STYLE.missed.stroke,
        color: VERDICT_STYLE.missed.stroke,
      },
    },
    {
      selector: 'edge',
      style: {
        label: 'data(label)',
        'curve-style': 'bezier',
        'line-color': '#475569',
        'target-arrow-color': '#475569',
        'target-arrow-shape': 'triangle',
        width: 2,
        'font-size': 11,
        'text-background-color': '#ffffff',
        'text-background-opacity': 0.85,
        'text-background-padding': '2px',
        'text-rotation': 'autorotate',
        color: '#334155',
      },
    },
  ];

  for (const kind of VERDICT_ORDER) {
    const style = VERDICT_STYLE[kind];
    const arrow = ARROW[style.marker];
    sheet.push({
      selector: `edge[verdict = "${kind}"]`,
      style: {
        'line-color': style.stroke,
        'target-arrow-color': style.stroke,
        'target-arrow-shape': arrow.shape,
        'target-arrow-fill': arrow.fill,
        width: style.width,
        'line-style': style.dash ? 'dashed' : 'solid',
        // Cytoscape takes a single dash length, not SVG's on/off pair. The first number is the
        // on-length, which is the one the eye reads as the pattern.
        ...(style.dash ? { 'line-dash-pattern': style.dash.split(' ').map(Number) } : {}),
        color: style.stroke,
      },
    });
  }

  return sheet;
}
