// Build docs/brief.standalone.html: one file that renders identically with no network.
//
// The published brief fetches MathJax from cdnjs and fonts from Google. That is fine on a
// machine with a connection and wrong everywhere else -- on a plane, behind a campus firewall,
// from a USB stick, or in five years when a CDN path has moved. For a page that is a third
// mathematics, "the equations show as raw LaTeX" is not a graceful degradation.
//
// So: every equation is pre-rendered to SVG here, at build time, and the MathJax runtime and
// the webfont links are removed entirely. What ships is glyph outlines, which need nothing.

import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const SRC = 'web/brief/index.html';
// The build output is published into docs/, not kept beside its source: the source is a
// build input that lives with the machinery, the output is the file a reader is handed.
// --check compares the two, so publishing them to different trees cannot let them drift.
const OUT = '../docs/brief.standalone.html';
// --check rebuilds and compares instead of writing, so a source edit that never made it into
// the committed build fails CI rather than being discovered by whoever you emailed it to.
const CHECK = process.argv.includes('--check');

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document('', {
  InputJax: new TeX({ packages: AllPackages, tags: 'none' }),
  // fontCache 'none' inlines each glyph path into its own SVG. 'local' would emit <defs>
  // referenced by id, which breaks the moment two equations are reordered or one is copied
  // out of the page. Larger, and correct.
  OutputJax: new SVG({ fontCache: 'none' }),
});

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&minus;': '−', '&mdash;': '—', '&ndash;': '–',
  '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”',
  '&nbsp;': ' ',
};

function decode(tex) {
  return tex.replace(/&[a-z]+;/gi, (e) => (e in ENTITIES ? ENTITIES[e] : e));
}

let rendered = 0;
function render(tex, display) {
  const node = doc.convert(decode(tex), { display, em: 17, ex: 8, containerWidth: 680 });
  rendered += 1;
  let svg = adaptor.innerHTML(node);
  // The wrapper mjx-container is a custom element the page styles; keep the SVG only and
  // let currentColor carry the theme, exactly as the runtime version does.
  svg = svg.replace(/<svg /, '<svg role="math" ');
  return display
    ? `<span class="mjx-block" aria-label="equation">${svg}</span>`
    : `<span class="mjx-inline">${svg}</span>`;
}

let html = readFileSync(SRC, 'utf-8');
const before = html.length;

// ---- 1. pre-render every equation --------------------------------------------------------
// Display math first, so that the \( \) pass cannot chew into a \[ \] body.
html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_, tex) => render(tex, true));
html = html.replace(/\\\(([\s\S]*?)\\\)/g, (_, tex) => render(tex, false));

// ---- 2. drop the runtime and the webfont links -------------------------------------------
html = html.replace(/<script>\s*window\.MathJax[\s\S]*?<\/script>\s*/, '');
html = html.replace(/<script id="MathJax-script"[\s\S]*?<\/script>\s*/, '');
html = html.replace(/<link rel="preconnect"[^>]*>\s*/g, '');
html = html.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/, '');

// ---- 3. system font stacks ---------------------------------------------------------------
// Newsreader, Archivo and IBM Plex Mono are not on a stranger's machine. Noto Sans TC stays in
// each stack because a reader who has it gets the intended CJK face; the rest are what Windows,
// macOS and Linux actually ship.
html = html.replace(
  /--serif:"Newsreader","Noto Sans TC",Georgia,"Times New Roman",serif;/,
  '--serif:Georgia,"Noto Sans TC","PingFang TC","Microsoft JhengHei",' +
    '"Times New Roman",serif;',
);
html = html.replace(
  /--sans:"Archivo","Noto Sans TC",system-ui,-apple-system,"Segoe UI",sans-serif;/,
  '--sans:system-ui,-apple-system,"Segoe UI","Noto Sans TC","PingFang TC",' +
    '"Microsoft JhengHei",sans-serif;',
);
html = html.replace(
  /--mono:"IBM Plex Mono",ui-monospace,"SFMono-Regular",Consolas,monospace;/,
  '--mono:ui-monospace,"SFMono-Regular",Consolas,"Courier New",monospace;',
);
// The inline SVG font-family attributes in the two prototype figures.
html = html.replace(/IBM Plex Mono, monospace/g, 'ui-monospace, Consolas, monospace');

// ---- 4. styles the runtime used to supply -------------------------------------------------
const MJX_CSS = `
/* Pre-rendered mathematics. These rules replace what the MathJax runtime injected. */
.mjx-block{display:block; overflow-x:auto; overflow-y:hidden; padding:14px 4px; text-align:left}
.mjx-block svg{max-width:100%; height:auto}
.mjx-inline{display:inline-block; vertical-align:middle}
.mjx-inline svg{vertical-align:middle}
.mjx-block svg, .mjx-inline svg{color:var(--ink); fill:currentColor; stroke-width:0}
`;
html = html.replace(
  /mjx-container\[display="true"\][\s\S]*?mjx-container\{color:var\(--ink\)\}/,
  MJX_CSS.trim(),
);

// ---- 5. a banner so a reader knows which file they have ----------------------------------
html = html.replace(
  '<title>Scene Graph Studio</title>',
  '<title>Scene Graph Studio</title>\n' +
    '<!-- Standalone build. Every equation is pre-rendered SVG; no network requests of any\n' +
    '     kind. Generated by tools/build_standalone.mjs from system/web/brief/index.html -- edit that\n' +
    '     file, not this one, and re-run `npm run build:standalone`. -->',
);

if (CHECK) {
  if (!existsSync(OUT)) {
    console.error(`standalone: ${OUT} is missing. Run \`npm run build:standalone\`.`);
    process.exit(1);
  }
  if (readFileSync(OUT, 'utf-8') !== html) {
    console.error(
      `standalone: ${OUT} is stale -- ${SRC} has changed since it was built.
` +
        '  Run `npm run build:standalone` and commit the result.',
    );
    process.exit(1);
  }
} else {
  writeFileSync(OUT, html, 'utf-8');
}

// ---- 6. refuse to ship anything that still reaches the network ---------------------------
const remote = [...html.matchAll(/(?:src|href)\s*=\s*"(https?:\/\/[^"]+)"/g)]
  .map((m) => m[1])
  // doi.org and arxiv.org are citation namespaces, not resources. A reader may click one;
  // the page never fetches it, so neither costs the offline guarantee this file exists for.
  // NFR-2 and D-21 require every reported figure to name the table it came from, and a named
  // table with no reachable identifier is not much of a citation. Anything else -- a script,
  // a stylesheet, a webfont, an image -- is a real fetch and still fails the build.
  .filter((u) => !u.startsWith('https://doi.org/') && !u.startsWith('https://arxiv.org/'));
if (remote.length) {
  console.error('standalone build FAILED: still fetches\n  ' + remote.join('\n  '));
  process.exit(1);
}
if (rendered < 20) {
  console.error(`standalone build FAILED: only ${rendered} equations rendered; expected 20+`);
  process.exit(1);
}

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
if (CHECK) {
  console.log(`standalone: up to date (${rendered} equations, ${kb(html.length)})`);
} else {
  console.log(`standalone: ${rendered} equations pre-rendered to SVG`);
  console.log(`            ${OUT}`);
  console.log(`            ${kb(before)} -> ${kb(html.length)}, no network requests`);
}
