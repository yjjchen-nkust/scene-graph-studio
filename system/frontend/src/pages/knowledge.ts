import assignment from '../../../../data/content/assignment.json';
import raw from '../../../../data/content/kp.json';
import { getMeta } from '../content/registry';

export interface KnowledgePoint {
  id: string;
  cluster: string;
  cluster_en: string;
  cluster_zh: string;
  title_en: string;
  title_zh: string;
  knobs: string;
  status: 'live' | 'spec';
  math: string;
}

export const POINTS = raw as KnowledgePoint[];

export interface Cluster {
  id: string;
  en: string;
  zh: string;
}

/** The twelve clusters, in the order the harvest emits them, which is the frozen page's order. */
export const CLUSTERS: Cluster[] = POINTS.reduce<Cluster[]>((out, p) => {
  if (!out.some((c) => c.id === p.cluster)) {
    out.push({ id: p.cluster, en: p.cluster_en, zh: p.cluster_zh });
  }
  return out;
}, []);

export interface Teaching {
  moduleId: string;
  /** The step that mounts the point's playground, or `null` when no module step does. */
  playgroundStep: number | null;
}

const OWNER = new Map(
  Object.entries(assignment.modules).flatMap(([m, points]) => points.map((p) => [p, m] as const)),
);

/**
 * The module that teaches a knowledge point, and the step that mounts its playground.
 *
 * The owner comes from `assignment.json`, not from the modules' `knowledge_points`: a module's
 * frontmatter also lists the points it draws on, so M0 lists F5, which M1 teaches, and reading
 * the frontmatter would send the reader to the first module that mentions a point rather than the
 * one that owns it. The step is read off the owner's English frontmatter, since both locales
 * declare the same steps in the same order.
 */
export function teachingOf(id: string): Teaching | null {
  const moduleId = OWNER.get(id);
  const meta = moduleId ? getMeta(moduleId, 'en') : null;
  if (!moduleId || !meta) return null;
  const step = meta.steps.findIndex((s) => s.kind === 'playground' && s.kp === id);
  return { moduleId, playgroundStep: step === -1 ? null : step };
}
