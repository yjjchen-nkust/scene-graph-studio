import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import type { SceneGraph } from 'sgg-metrics';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/useLocale';
import { downloadText, ExportButtons, exportFilename } from '../ExportButtons';
import { isSelfContained } from '../svg';
import { fromVisualGenome } from '../vgJson';

const GRAPH: SceneGraph = {
  image_id: 'isg-001',
  dataset: 'mini-isg',
  width: 1280,
  height: 720,
  objects: [
    { object_id: 1, names: ['hand'], bbox: { x: 1, y: 1, w: 10, h: 10 } },
    { object_id: 2, names: ['beam'], bbox: { x: 20, y: 20, w: 30, h: 30 } },
  ],
  relationships: [{ relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'holding' }],
  provenance: { kind: 'user', fidelity: 'measured' },
};

function captureDownloads() {
  const seen: { name: string; href: string }[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    seen.push({ name: this.download, href: this.href });
  });
  return seen;
}

function decode(href: string): string {
  return decodeURIComponent(href.slice(href.indexOf(',') + 1));
}

beforeEach(() => {
  setLocale('en');
  vi.restoreAllMocks();
});

describe('exportFilename', () => {
  it('names the dataset and the frame, because a downloads folder is flat', () => {
    expect(exportFilename(GRAPH, 'json')).toBe('mini-isg_isg-001.json');
  });
});

describe('downloadText', () => {
  it('leaves nothing behind in the document', () => {
    captureDownloads();
    downloadText('a.txt', 'text/plain', 'hello');
    expect(document.querySelectorAll('a')).toHaveLength(0);
  });
});

describe('ExportButtons', () => {
  it('offers the JSON export wherever there is a graph', () => {
    render(<ExportButtons graph={GRAPH} />);
    expect(screen.getByTestId('export-json')).toBeInTheDocument();
  });

  it('does not offer an SVG export where there is no overlay to serialise', () => {
    // A disabled button with no explanation is a worse answer than no button.
    render(<ExportButtons graph={GRAPH} />);
    expect(screen.queryByTestId('export-svg')).not.toBeInTheDocument();
  });

  it('downloads a document the Visual Genome reader accepts', () => {
    const seen = captureDownloads();
    render(<ExportButtons graph={GRAPH} />);
    fireEvent.click(screen.getByTestId('export-json'));

    expect(seen).toHaveLength(1);
    expect(seen[0]!.name).toBe('mini-isg_isg-001.json');
    // Round-tripped through the reader, not merely non-empty: an export nothing can read is
    // the failure this whole module exists to prevent.
    expect(fromVisualGenome(JSON.parse(decode(seen[0]!.href)))).toEqual(GRAPH);
  });

  /** The buttons before the overlay, as a lab lays them out: the ref is attached after them. */
  function Host({ imageUrl }: { imageUrl?: string }) {
    const area = useRef<HTMLDivElement>(null);
    return (
      <div>
        <ExportButtons graph={GRAPH} targetRef={area} imageUrl={imageUrl} />
        <div ref={area}>
          <svg viewBox="0 0 10 10">
            <rect data-testid="box" x="1" y="1" width="2" height="2" />
          </svg>
        </div>
      </div>
    );
  }

  it('offers the SVG export once the overlay mounts, without waiting for another render', () => {
    // The ref is null while the buttons render for the first time. Read then, it hid the button
    // until something unrelated rendered the buttons again, which on a lab nobody touches is
    // never. One `render`, and no `rerender`, is the case.
    render(<Host />);

    const seen = captureDownloads();
    fireEvent.click(screen.getByTestId('export-svg'));
    expect(seen[0]!.name).toBe('mini-isg_isg-001.svg');
    expect(decode(seen[0]!.href)).toContain('<rect');
    expect(decode(seen[0]!.href)).not.toContain('data-testid');
  });

  it('puts the photograph in the SVG, beneath the boxes', () => {
    // The overlay on screen is an <img> with an <svg> over it; serialising the <svg> alone
    // exports boxes over nothing.
    render(<Host imageUrl="data:image/png;base64,iVBORw0KGgo=" />);
    const seen = captureDownloads();
    fireEvent.click(screen.getByTestId('export-svg'));
    const svg = decode(seen[0]!.href);
    expect(svg).toMatch(/<svg[^>]*><image[^>]+href="data:image\/png;base64,iVBORw0KGgo="/);
    expect(isSelfContained(svg)).toBe(true);
  });

  it('embeds only a data: URI, because any other address will not travel with the file', () => {
    render(<Host imageUrl="/images/isg-001.jpg" />);
    const seen = captureDownloads();
    fireEvent.click(screen.getByTestId('export-svg'));
    const svg = decode(seen[0]!.href);
    expect(svg).not.toContain('<image');
    expect(isSelfContained(svg)).toBe(true);
  });
});
