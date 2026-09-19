import type { RefObject } from 'react';
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
 * Export the graph on screen, PRD §6.6.
 *
 * Two buttons, because the two exports answer different questions: the JSON is for another tool
 * to read, and the SVG is for a slide. The SVG button is offered only where there is an overlay
 * to serialise — a disabled button with no explanation is a worse answer than no button.
 *
 * The SVG is found by looking inside `targetRef` rather than being passed as a ref of its own.
 * The labs render their own overlays and do not expose them, and reaching in through one
 * container the mount already owns is a smaller change than threading a ref through every lab.
 */
export function ExportButtons({
  graph,
  targetRef,
}: {
  graph: SceneGraph;
  targetRef?: RefObject<HTMLElement | null>;
}) {
  const { t } = useLocale();
  const svgNode = targetRef?.current?.querySelector('svg') ?? null;

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
            downloadText(exportFilename(graph, 'svg'), 'image/svg+xml', exportSvg(svgNode))
          }
          className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
        >
          {t('export.svg')}
        </button>
      )}
    </div>
  );
}
