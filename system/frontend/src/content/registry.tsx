import type { ComponentProps, ComponentType, ReactNode } from 'react';
import { Demo } from '../demos/Demo';
import type { Locale } from '../i18n/useLocale';
import { Playground } from '../playgrounds/Playground';

export interface ModuleSymbol {
  sym: string;
  gloss_en: string;
  gloss_zh: string;
}

export interface ModuleClaim {
  id: string;
  text_en?: string;
  text_zh?: string;
  source: string;
  source_table: string;
  constraint: string;
  protocol: string;
  verified: boolean;
}

export interface ModuleStepMeta {
  id: string;
  kind: 'prose' | 'math' | 'figure' | 'lab' | 'checkpoint' | 'playground' | 'demo';
  lab?: string;
  /** The knowledge point a `playground` step demonstrates. Contracts §2.4. */
  kp?: string;
  /** The demonstration a `demo` step replays: D-T or D-V. Contracts §2.4. */
  demo?: 'DT' | 'DV';
  /**
   * Which part of a playground or a demo split across consecutive steps this step shows.
   * Contracts §2.4.
   */
  part?: number;
  seconds_budget?: number;
  /**
   * The presenter window's notes for this step, in the locale of the file that declares them.
   *
   * A module is two files and each carries its own locale's field, so exactly one of the two is
   * ever populated on a step returned by `getModule`. Carrying both in both files would be the
   * same sentence written twice in two places, and `content_lint.mjs` refuses it — along with
   * the drift that matters more: the two locales must agree on *which* steps have notes, or the
   * professor gets a notes pane in one language and an empty one in the other.
   *
   * Typed optional, and populated everywhere: all 92 steps carry notes in both locales as of
   * 2026-09-19, and `content_lint.mjs` refuses a step without them (D76). It was M0 alone when
   * this was written. The field stays optional because a module being authored has none yet, and
   * the window says plainly where there are none rather than showing prose nobody chose to say.
   * See DEVIATIONS D56 and D76.
   */
  presenter_notes_en?: string;
  presenter_notes_zh?: string;
}

export interface ModuleMeta {
  id: string;
  order: number;
  title_en: string;
  title_zh: string;
  anchor_labs?: string[];
  knowledge_points?: string[];
  symbols?: ModuleSymbol[];
  claims?: ModuleClaim[];
  steps: ModuleStepMeta[];
}

/** Contracts §2.4. `node` is what a shell renders; the shells differ in layout and nothing else. */
export interface ModuleStep extends ModuleStepMeta {
  node: ReactNode;
}

interface MdxModule {
  meta: ModuleMeta;
  default: ComponentType<{ components?: MdxComponents }>;
}

interface StepProps {
  id: string;
  children?: ReactNode;
}

/**
 * `components` carries three shapes at once: `Step` takes `StepProps`, `Playground` its `kp` and
 * `Demo` its `id` (each read off the real component rather than redeclared, so they cannot
 * drift). A plain `Record<string, ComponentType<StepProps>>` would honestly reject the other two
 * — they really do take different props — so this widens to the union instead of casting past
 * the checker.
 */
type MdxComponents = Record<
  string,
  | ComponentType<StepProps>
  | ComponentType<ComponentProps<typeof Playground>>
  | ComponentType<ComponentProps<typeof Demo>>
>;

/**
 * Every module, in both locales, found at build time.
 *
 * `import.meta.glob` rather than a hand-kept list, because a list is a second place to register a
 * module and therefore a place to forget one. The content lint already refuses a module present
 * in one locale only, so anything that lands here lands in both.
 *
 * Eager, not lazy. The corpus is fifteen modules of prose, and the reason mathematics is typeset
 * at build time is that a lecture should never wait for anything; a lazy import would put a
 * network round trip back at exactly the moment NFR-1 is about.
 */
const FILES = import.meta.glob<MdxModule>('./m*.mdx', { eager: true });

export function moduleIds(): string[] {
  const ids = new Set<string>();
  for (const path of Object.keys(FILES)) {
    const match = /\.\/(m\d\d)\./.exec(path);
    if (match) ids.add(match[1]!);
  }
  return [...ids].sort();
}

export function getMeta(id: string, locale: Locale): ModuleMeta | null {
  return FILES[`./${id}.${locale}.mdx`]?.meta ?? null;
}

/**
 * The module as an ordered step list, which is what both shells consume.
 *
 * MDX compiles a module to one component, not to a sequence, so the body marks its own
 * boundaries with `<Step id="s1">`. The ids are declared once in the frontmatter — where the
 * lint can check that both locales agree on them — and the body says where each one begins.
 *
 * Each step's `node` renders the same body with a `Step` that admits only that id, so a step is
 * genuinely its own React node rather than a slice of a rendered blob. Splitting the compiled
 * output by heading instead would make the step boundaries depend on how the author happened to
 * format the prose, and a translator adding a subheading would silently change the lecture.
 */
export function getModule(id: string, locale: Locale): ModuleStep[] | null {
  const found = FILES[`./${id}.${locale}.mdx`];
  if (!found) return null;
  const Body = found.default;
  return found.meta.steps.map((step) => {
    const Only = ({ id: stepId, children }: StepProps) =>
      stepId === step.id ? <>{children}</> : null;
    // `Playground` and `Demo` join `Step` here rather than being imported by each MDX file: see
    // `Playground`'s own docstring.
    return { ...step, node: <Body components={{ Step: Only, Playground, Demo }} /> };
  });
}
