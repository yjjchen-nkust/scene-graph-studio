const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/** A reference that will not travel with the file. `#fragment` and `data:` both will. */
function isExternalRef(value: string): boolean {
  const target = value.trim();
  if (target === '' || target.startsWith('#') || target.startsWith('data:')) return false;
  return true;
}

/**
 * Whether a serialised SVG stands on its own.
 *
 * Exported as a predicate rather than kept inside `exportSvg`, so the rule the export asserts is
 * the rule a caller can check — including on a file that came from somewhere else.
 */
export function isSelfContained(svg: string): boolean {
  if (/@import/i.test(svg)) return false;
  if (/\s(?:xlink:)?href\s*=\s*"(?!#|data:)[^"]*"/i.test(svg)) return false;
  // `url(#arrow)` attaches a marker and is internal; `url(https://…)` is not.
  for (const match of svg.matchAll(/url\(\s*['"]?([^)'"]*)['"]?\s*\)/gi)) {
    if (isExternalRef(match[1] ?? '')) return false;
  }
  return true;
}

export interface ExportSvgOptions {
  /**
   * The frame, as a `data:` URI, drawn beneath everything else.
   *
   * The overlay on screen is an `<img>` with an `<svg>` positioned over it, so serialising the
   * SVG alone exports the boxes and loses the photograph. A figure in a slide deck needs both,
   * in one file, with nothing to fetch.
   */
  imageDataUrl?: string;
}

/**
 * A live overlay, serialised into a file that opens anywhere.
 *
 * **No external references.** An exported figure ends up in a slide deck, and a reference to a
 * URL breaks silently on the projector — usually in the one room with no network. External
 * `href`s are removed, `@import` is removed, and `isSelfContained` states the rule as something
 * a caller can assert.
 *
 * **Nothing is inlined from a stylesheet, because nothing needs to be.** Every colour, stroke
 * width and dash in `graph/ImageOverlay.tsx` is an SVG presentation attribute taken from the
 * palette, not a class. The `class` attributes that remain are `cursor-pointer` and the like —
 * interaction, not appearance — and they are stripped, because a class without its stylesheet is
 * a reference to something absent.
 *
 * The node is cloned first: the overlay stays on screen after an export.
 */
export function exportSvg(node: SVGSVGElement, options: ExportSvgOptions = {}): string {
  if (!(node instanceof SVGSVGElement)) {
    throw new Error('exportSvg: expected an <svg> element');
  }

  const clone = node.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', SVG_NS);

  for (const element of [clone, ...clone.querySelectorAll('*')]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name;
      if (name.startsWith('data-') || name === 'class') {
        element.removeAttribute(name);
        continue;
      }
      if ((name === 'href' || name === 'xlink:href') && isExternalRef(attribute.value)) {
        element.removeAttribute(name);
        element.removeAttributeNS(XLINK_NS, 'href');
      }
    }
    if (element.tagName.toLowerCase() === 'style' && /@import/i.test(element.textContent ?? '')) {
      element.textContent = (element.textContent ?? '').replace(/@import[^;]*;?/gi, '');
    }
  }

  if (options.imageDataUrl) {
    const image = clone.ownerDocument.createElementNS(SVG_NS, 'image');
    image.setAttribute('href', options.imageDataUrl);
    image.setAttribute('x', '0');
    image.setAttribute('y', '0');
    image.setAttribute('width', '100%');
    image.setAttribute('height', '100%');
    image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    clone.prepend(image);
  }

  return new XMLSerializer().serializeToString(clone);
}
