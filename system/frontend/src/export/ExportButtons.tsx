import { useEffect, useState, type RefObject } from 'react';
import type { SceneGraph } from 'sgg-metrics';
import { useLocale } from '../i18n/useLocale';
import { exportSvg } from './svg';
import { toVisualGenome } from './vgJson';

/** `mini-isg_isg-001.json`. The dataset and the frame, because a downloads folder is flat. */
export function exportFilename(graph: SceneGraph, extension: string): string {
  return `${graph.dataset}_${graph.image_id}.${extension}`;
}

/**
 * Hand the browser a file.
 *
 * A `data:` URL rather than `URL.createObjectURL`: there is no object to revoke, so there is no
 * leak to forget, and the payloads here are one scene graph.
 */
export function downloadText(filename: string, mediaType: string, text: string): void {
  const anchor = document.createElement('a');
  anchor.href = `data:${mediaType};charset=utf-8,${encodeURIComponent(text)}`;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Export a constructed graph, PRD §6.6: the one the student built, which is the caller's to pass.
 *
 * Two buttons, because the two exports answer different questions: the JSON is for another tool
 * to read, and the SVG is for a slide. The SVG button is offered only where there is an overlay
 * to serialise — a disabled button with no explanation is a worse answer than no button.
 *
 * The SVG is found by looking inside `targetRef` rather than being passed as a ref of its own.
 * `ImageOverlay` does not expose its `<svg>`, and reaching in through one container the lab
 * already owns is a smaller change than threading a ref through it.
 *
 * It is looked for after the commit, never during render. A ref is null while its element's
 * first render is in progress, and the buttons sit before the overlay, so a lookup during render
 * hid the button until something unrelated rendered them again. A passive effect runs once every
 * ref in the commit is attached, whatever the order of the elements.
 *
 * `imageUrl` is the frame beneath the overlay. It is embedded only as a `data:` URI, which is
 * what the API serves with `include_image=true`: any other address is a reference that will not
 * travel with the file, and `exportSvg` exists to remove exactly those.
 */
export function ExportButtons({
  graph,
  targetRef,
  imageUrl,
}: {
  graph: SceneGraph;
  targetRef?: RefObject<HTMLElement | null>;
  imageUrl?: string;
}) {
  const { t } = useLocale();
  const [svgNode, setSvgNode] = useState<SVGSVGElement | null>(null);

  // No dependency list: the overlay can appear or be replaced inside the target without any
  // prop of this component changing, and one `querySelector` per render costs nothing. Setting
  // the node it already holds is a no-op, so this cannot loop.
  useEffect(() => {
    setSvgNode(targetRef?.current?.querySelector('svg') ?? null);
  });

  const imageDataUrl = imageUrl?.startsWith('data:') ? imageUrl : undefined;

  return (
    <div className="mb-4 flex gap-2 text-sm">
      <button
        type="button"
        data-testid="export-json"
        onClick={() =>
          downloadText(
            exportFilename(graph, 'json'),
            'application/json',
            JSON.stringify(toVisualGenome(graph), null, 2),
          )
        }
        className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
      >
        {t('export.json')}
      </button>

      {svgNode && (
        <button
          type="button"
          data-testid="export-svg"
          onClick={() =>
            downloadText(
              exportFilename(graph, 'svg'),
              'image/svg+xml',
              exportSvg(svgNode, { imageDataUrl }),
            )
          }
          className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
        >
          {t('export.svg')}
        </button>
      )}
    </div>
  );
}
