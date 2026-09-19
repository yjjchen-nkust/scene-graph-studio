import type { Core, ElementDefinition, EventObject, LayoutOptions } from 'cytoscape';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { useEffect, useRef } from 'react';
import type { SceneGraph, Verdict } from 'sgg-metrics';
import { cyStylesheet } from './cyStyle';
import type { LayoutName } from './elements';
import { buildElements } from './elements';

export interface SceneGraphViewProps {
  graph: SceneGraph;
  /**
   * The ground truth the verdicts were scored against.
   *
   * Contracts §2.6 omits it, which cannot be right: a `missed` verdict carries `pred_index: -1`
   * and names a triplet in the ground-truth graph, so without that graph the one verdict the
   * diff exists to show is the one edge that cannot be drawn. See DEVIATIONS.md D23.
   */
  gt?: SceneGraph;
  verdicts?: Verdict[]; // present → four-colour diff mode
  layout: LayoutName; // 'preset' pins nodes at box centroids over the image
  onEdgeClick?: (relationshipId: number) => void;
  onNodeClick?: (objectId: number) => void;
  className?: string;
}

cytoscape.use(dagre);

/**
 * The scene graph as a node-link diagram.
 *
 * Two layouts, and the choice is pedagogical rather than cosmetic. `dagre` lays the graph out by
 * its structure, which is how a scene graph is usually read; `preset` pins every node at its
 * box centroid so the diagram sits in register with the photograph and a student can see which
 * blob in the image each node is. The second is what makes the overlay and this view comparable.
 *
 * A `missed` verdict becomes a ghost edge that exists in no `relationships` array, because an
 * unmatched ground-truth triplet is precisely the thing the prediction does not contain. Drawing
 * only what was predicted would make recall invisible in the one view meant to explain it.
 */
export function SceneGraphView({
  graph,
  gt,
  verdicts,
  layout,
  onEdgeClick,
  onNodeClick,
  className = '',
}: SceneGraphViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  // Handlers are read through a ref so a new callback identity does not tear down the graph.
  // Written in an effect, not during render: a ref mutated while rendering is torn under
  // concurrent React, where a render can be thrown away after it has already run.
  const handlers = useRef({ onEdgeClick, onNodeClick });
  useEffect(() => {
    handlers.current = { onEdgeClick, onNodeClick };
  });

  const elements = buildElements(graph, gt, verdicts ?? [], layout);
  const signature = JSON.stringify(elements);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cy = cytoscape({
      container,
      elements: JSON.parse(signature) as ElementDefinition[],
      style: cyStylesheet(),
      // dagre's options are not in cytoscape's own LayoutOptions union -- the extension
      // publishes its own interface — so the cast is where the two type worlds meet.
      layout: (layout === 'preset'
        ? { name: 'preset' }
        : { name: 'dagre', rankDir: 'LR', nodeSep: 24, rankSep: 60 }) as unknown as LayoutOptions,
      // A teaching diagram, not a workspace: panning and zooming are fine, dragging a node out
      // of a preset layout would break the registration with the photograph.
      autoungrabify: layout === 'preset',
      wheelSensitivity: 0.2,
    });
    cyRef.current = cy;

    cy.on('tap', 'edge', (event: EventObject) => {
      handlers.current.onEdgeClick?.(event.target.data('relationshipId') as number);
    });
    cy.on('tap', 'node', (event: EventObject) => {
      handlers.current.onNodeClick?.(event.target.data('objectId') as number);
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [signature, layout]);

  return (
    <div
      ref={containerRef}
      data-testid="cy-container"
      className={`h-full w-full ${className}`}
      role="img"
      aria-label={`${graph.objects.length} objects, ${graph.relationships.length} relationships`}
    />
  );
}
