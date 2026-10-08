# S6 Course content

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `system/frontend/src/content/` | The 15 modules as bilingual MDX |
| `system/mdx.plugin.ts` | Vite plugin that compiles the MDX modules |
| `system/tools/harvest.mjs` | Harvests the knowledge map into the seed corpus |
| `system/tools/kp_latex.mjs` | Converts harvested LaTeX to the delimiters MDX reads |
| `system/tools/gen_modules.py` | Emits the remaining module files |
| `system/tools/content_lint.mjs` | Content lint: golden vectors, licence gates and the module rules |
| `system/tools/test/harvest.test.mjs` | Tests of the harvest |
| `system/tools/test/kp_latex.test.mjs` | Tests of the LaTeX delimiter conversion |
| `system/tools/test/content_lint.test.mjs` | Tests that each lint rule fails when disabled |
| `data/content/` | Harvested corpus and golden playground cases (NAS) |

## 3. Interfaces

DRAFT

## 4. Current rules

DRAFT

## 5. Verification

DRAFT

## 6. Traps

DRAFT

## 7. History

DRAFT

## 8. Open items

DRAFT
