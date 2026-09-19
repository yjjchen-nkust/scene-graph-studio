import { beforeEach, describe, expect, it } from 'vitest';
import { exportSvg, isSelfContained } from '../svg';

function svgWith(inner: string, attrs = ''): SVGSVGElement {
  const host = document.createElement('div');
  host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" ${attrs}>${inner}</svg>`;
  document.body.append(host);
  return host.querySelector('svg')!;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('exportSvg', () => {
  it('serialises the node it was given', () => {
    const svg = exportSvg(svgWith('<rect x="1" y="2" width="3" height="4"></rect>'));
    expect(svg).toContain('<rect');
    expect(svg).toContain('viewBox="0 0 100 80"');
  });

  it('declares the SVG namespace, so the file opens on its own', () => {
    const node = svgWith('<rect/>');
    node.removeAttribute('xmlns');
    expect(exportSvg(node)).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('exports an SVG that carries no external references', () => {
    // An exported figure ends up in a slide deck, and an external reference makes it break
    // silently on the projector — usually in the one room with no network.
    const svg = exportSvg(
      svgWith('<image href="https://example.com/frame.png" width="10" height="10"></image>'),
    );
    expect(svg).not.toMatch(/<image[^>]+href="https?:/);
    expect(svg).not.toMatch(/@import/);
  });

  it('drops an external stylesheet import rather than exporting a reference to it', () => {
    const svg = exportSvg(svgWith('<style>@import url("https://fonts.example/x.css");</style>'));
    expect(svg).not.toMatch(/@import/);
  });

  it('keeps an embedded data URI, which is what makes the file self-contained', () => {
    const svg = exportSvg(
      svgWith('<image href="data:image/png;base64,iVBORw0KGgo=" width="10" height="10"></image>'),
    );
    expect(svg).toContain('data:image/png;base64');
  });

  it('strips the attributes the application uses and a reader does not', () => {
    const svg = exportSvg(svgWith('<rect data-testid="box-1" data-verdict="match"></rect>'));
    expect(svg).not.toContain('data-testid');
  });

  it('does not modify the live node it was handed', () => {
    // The overlay stays on screen after an export, so serialising has to work on a copy.
    const node = svgWith('<image href="https://example.com/frame.png"></image>');
    exportSvg(node);
    expect(node.querySelector('image')!.getAttribute('href')).toBe('https://example.com/frame.png');
  });

  it('embeds the frame beneath the overlay, so the figure is one file', () => {
    const svg = exportSvg(svgWith('<rect/>'), {
      imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(svg).toMatch(/<image[^>]+data:image\/png/);
    expect(isSelfContained(svg)).toBe(true);
  });

  it('refuses anything that is not an SVG element', () => {
    expect(() => exportSvg(document.createElement('div') as never)).toThrow(/svg/i);
  });
});

describe('isSelfContained', () => {
  it('is the predicate the export asserts, usable on any string', () => {
    expect(isSelfContained('<svg><image href="data:image/png;base64,AA"/></svg>')).toBe(true);
    expect(isSelfContained('<svg><image href="https://x/y.png"/></svg>')).toBe(false);
    expect(isSelfContained('<svg><style>@import url(x)</style></svg>')).toBe(false);
    expect(isSelfContained('<svg><rect fill="url(https://x/y)"/></svg>')).toBe(false);
  });

  it('does not mistake a local fragment reference for an external one', () => {
    // `url(#marker)` is how an arrowhead is attached, and it is entirely internal.
    expect(isSelfContained('<svg><path marker-end="url(#arrow)"/></svg>')).toBe(true);
  });
});
