import mdx from '@mdx-js/rollup';
import type { Plugin } from 'vite';
import rehypeKatex from 'rehype-katex';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMath from 'remark-math';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';

/**
 * The MDX plugin, defined once for the build and the test run.
 *
 * Two copies would be two pipelines, and the failure they permit is the worst kind: a module
 * whose mathematics typesets under vitest and arrives as dollar signs on the projector, or the
 * reverse. `enforce: 'pre'` puts it ahead of the React plugin, which would otherwise claim the
 * file first.
 *
 * Typesetting happens here, at build time, so nothing is fetched at run time and no student pays
 * a typesetting cost during a lecture (SRS §11.3, NFR-1).
 */
export function mdxPlugin(): Plugin {
  return {
    enforce: 'pre',
    ...mdx({
      remarkPlugins: [remarkFrontmatter, [remarkMdxFrontmatter, { name: 'meta' }], remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  };
}
