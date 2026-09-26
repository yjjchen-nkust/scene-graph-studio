# Project playbook — how this was built, as prompts you can reuse

Extracted from Scene Graph Studio on 2026-09-16, so the next teaching application of this shape
can be produced without rediscovering the method.

This is not a description of the software. It is the **sequence of prompts** that produced it, the
artifact each one is required to emit, and the gate each one has to clear before the next begins.
Every pattern below is in this repository and can be read as a worked example.

**How to use it.** Work top to bottom. Replace the bracketed fields, keep everything else — the
constraints are what make the output trustworthy, not decoration. Do not skip Stage 3; more than
half the decisions in this project came out of it, and several reversed what Stage 2 assumed.

---

## The shape, in one table

| # | SDLC stage | Prompt produces | Gate before moving on |
|---|---|---|---|
| 1 | Inception | Anchor, audience, non-goals | The anchor is one paper or one system, named |
| 2 | Requirements | `PRD.md` | Every goal is checkable by a person, not a vibe |
| 3 | Research | Findings woven into the design | Every claim has a primary source and a date |
| 4 | Architecture | `SRS.md` + `contracts.md` | Field names and enum spellings are fixed |
| 5 | Review artifact | A bilingual design brief, published | A human has argued with it |
| 6 | Decisions | `decisions.md`, D-01… | Every open question is closed or explicitly deferred |
| 7 | Planning | `NN-*.md` plans, one per subsystem | Each plan ends in something demonstrable |
| 8 | Build | Code, test-first at the core | CI is one command and it is green |
| 9 | Verification | Golden vectors, parity, lints | Two implementations agree on every fixture |
| 10 | Stewardship | `DEVIATIONS.md`, `FROZEN.md` | Every departure from plan is written down |

---

## Stage 1 — Inception

> I am building teaching material for **[course name]**, audience **[who, and their actual
> background]**. The anchor is **[one paper, with DOI, or one system]**. I want a locally-run,
> [bilingual X ／ Y] application that teaches **[subject]** from first principles to the current
> frontier, using the anchor as the case study students judge rather than admire.
>
> Before proposing anything: state what makes this subject *treacherous* — the places where the
> published literature contradicts itself, where a metric rewards the wrong behaviour, or where a
> benchmark is quietly broken. Those are the lessons. If you cannot find at least three, say so
> and stop.
>
> Then give me: the audience's jobs-to-be-done, five goals stated so a person could check them,
> and an explicit non-goals list.

**Why the treachery question is first.** It is what separates teaching material from a summary.
In this project it produced the four hazards that became the spine of the whole course: three
incompatible splits under one dataset name, a metric a pixel-blind baseline wins, a benchmark that
ranked wrongly for two years, and a leaderboard that no longer exists.

---

## Stage 2 — Requirements (`PRD.md`)

> Write `docs/superpowers/specs/[date]-[name]-PRD.md`. Sections: summary; problem; users and
> jobs-to-be-done as a table; goals **G1…Gn**, each phrased so a person could verify it; non-goals;
> features at P0/P1/P2; the curriculum as a module table; success criteria split into measurable
> and qualitative; constraints that shape the product; and a final section, **"What we will not
> claim"**.
>
> Hard rules: no feature is P0 if it needs the network, a GPU, or an API key. Every quantitative
> claim carries a source. If a dataset or result the anchor depends on is not publicly available,
> say so in "What we will not claim" and design around its absence rather than assuming access.

**The section that earns its place** is the last one. Writing down what you will *not* assert,
before any code exists, is what stops a teaching tool from laundering an unverifiable number into
a confident chart.

---

## Stage 3 — Research sweeps

Run these as separate, parallel investigations. Each must end in a table with a **date checked**.

> Sweep A — **data**. For every candidate dataset: scale, class and predicate counts, split
> definitions, and the licence *as the source itself states it*, with the URL you read it on.
> Flag name collisions. Flag anything whose licence page does not exist.
>
> Sweep B — **method and state of the art**. The lineage of the field as a taxonomy, and for each
> method the defect in its predecessor that it fixes. Numbers only with the table they came from.
>
> Sweep C — **prior art and stack**. Does a tool like this already exist? What is its state *right
> now* — not what its README claims. Probe the actual runtime environment and record measured
> versions, not assumed ones.

**Two findings in this project reversed earlier assumptions**, which is the point of doing this
before architecture rather than after: the anchor paper's dataset turned out to have no public
release at all, and the development machine's hardware table had been written from the wrong
machine. Both would have been expensive to discover during the build.

---

## Stage 4 — Architecture (`SRS.md` and `contracts.md`)

> Write the SRS: directory architecture; the canonical data model as typed interfaces; the one
> component that must be exactly right, specified to the last tie-break; the API surface as a
> table; non-functional requirements as **NFR-1…n**; and the testing strategy.
>
> Then write `contracts.md` separately: the normative field names, types and enum **spellings**,
> and the wire-format casing rule. Nothing may be a "convention" that lives only in someone's head.

Two rules from this project worth copying verbatim:

**The honesty envelope.** No number crosses a boundary naked. Every metric travels as a record
carrying its `k`, `protocol`, `constraint`, `source`, `verified` and `fidelity`, and there is *no
code path* that formats a bare number as a metric. A UI that receives an untagged number refuses
to render it.

**Name the split, never the family.** `vg150-sgb`, never `vg150`, because several releases
answer to the short name, differing in the validation carve-out and in filtering (D93). Pick the
unambiguous identifier once and forbid the ambiguous one in code and content alike.

---

## Stage 5 — The review artifact

> Produce the design brief as a **single self-contained page** — one file, no build step, no
> network — covering: why this needs building, one working interactive figure that demonstrates
> the core idea on synthetic data, the mathematics stated properly, what the research turned up,
> the labs, the constraints, the phase plan, and the open questions.
>
> Publish it. It is for arguing with, not for filing.

**Why a page rather than a document.** The figure is the argument. In this project the brief's one
live figure — drag *K*, toggle the constraint, watch the two headline metrics cross — settled more
design questions than the prose around it.

**Keep the authored file and the shipped file distinct.** The published brief pre-renders every
equation to SVG and strips the runtime, so it works on a plane and in five years. A check enforces
that the standalone is never stale against its source, and that it fetches nothing at run time.
Citation links, which a reader clicks, are allowlisted; scripts, stylesheets and fonts are not.

---

## Stage 6 — Decisions register (`decisions.md`)

> For every open question, write a numbered decision: **D-nn**, the decision in one line, the
> evidence, the consequence, and what it supersedes. When a decision changes, revise it *in place*
> with a dated note — never silently, never by deletion.
>
> Every plan and every task references decisions by number. A plan that contradicts a decision is
> wrong by construction.

This is the highest-leverage artifact in the whole method. It is what let two machines, two
sessions and a month's gap stay coherent: twenty-one numbered decisions, each traceable to the
evidence that forced it.

---

## Stage 7 — Implementation plans

> Split the SRS into plans, one per subsystem that produces working, testable software on its own.
> Write a **master plan** that is an index only: the dependency graph, the global constraints
> copied verbatim from the specs, and the rule every plan obeys.
>
> Each plan: goal, architecture, tech stack, spec path, global constraints, then tasks. Each task
> names exact files, declares what it **consumes** and **produces** with exact signatures, and
> breaks into 2–5 minute steps: write the failing test, run it and watch it fail, implement
> minimally, run it and watch it pass, commit.
>
> No placeholders. No "add error handling". No "similar to Task N" — repeat the code, because the
> executor may read tasks out of order.

**The split rule:** one plan across all subsystems produces a document no reviewer finishes and no
executor can checkpoint. Four plans of 8–12 days each, with a drawn dependency graph, is the shape
that worked.

---

## Stage 8 — Build

> Execute plan by plan. The correctness core is **test-first without exception** — it is the one
> component where a silent error teaches something false rather than crashing.
>
> Record every departure from the plan in `DEVIATIONS.md` as you go: what the plan said, what went
> wrong, what you did instead. A deviation that is not written down becomes folklore.

---

## Stage 9 — Verification

The gates that caught real defects here, in the order they earn their keep:

1. **Golden vectors.** Hand-compute the answers on small fixtures where a person can check the
   arithmetic on paper, and write them down *before* running the code. Include the traps: empty
   input, empty output, all-tied scores, duplicates, a threshold hit exactly, and a denominator
   with a single instance. Never paste engine output into an expectation.
2. **Two implementations, one truth.** Implement the core twice — the authoritative one and the
   one the UI needs for latency — and diff them over the same fixtures in CI. Verify the harness
   by deliberately breaking one side and confirming it fails.
3. **Parity lints.** Bilingual keys must exist in both locales or CI fails; there is no fallback
   locale, because a fallback hides the hole.
4. **Content lint.** Every quantitative claim carries a source and a verified flag.
5. **One command.** `npm run ci` runs all of it. If CI is several commands, it is not run.

> Make CI one local command, mirrored by a path-filtered workflow so it does not fire on unrelated
> commits.

---

## Stage 10 — Stewardship

> When an artifact stops being developed, **freeze it explicitly**: a `FROZEN.md` saying what is
> frozen, as of when, by which decision, and why it is kept rather than deleted.
>
> Freezing forbids *extending*. It does not forbid *correcting a statement that is false* — a
> frozen artifact that teaches something wrong is worse than one that is merely out of date. Log
> every correction with its evidence so the freeze stays auditable.

Include the trap that bit here: a frozen page containing a function named `evaluate()` that is a
teaching toy, not the engine. Say so in the freeze note, in bold, with the reason — promoting it
would ship something plausible and wrong that the parity check could not detect, because both
sides would be wrong together.

---

## Cross-cutting: data

> Answer these before writing any loader.
>
> 1. **Who downloads the corpus?** If the answer is "the author, once, by hand", then no script in
>    the repository downloads a dataset. Delete the fetcher; a script whose only user has already
>    done the work by hand is a liability.
> 2. **Two licence questions, not one.** Downloading for one's own use and distributing to a class
>    are different acts. Carry them as separate columns per dataset: may derived annotations be
>    committed, and may the image files be handed to students. Both start UNVERIFIED. **UNCLEAR
>    counts as NO.**
> 3. **Read the source's own statement**, not a survey and not a mirror. Record the licence, the
>    URL, and the date you read it. An absent statement is not a permissive one.
> 4. **Gate the scripts, not the reviewer.** The cutter refuses to write annotations for an
>    uncleared dataset; the bundler refuses to include one. Enforcement lives in code.
> 5. **Commit a generated placeholder slice** so a bare clone with no corpora runs every feature.
>    This is what makes "works offline" true rather than aspirational.
> 6. **Commit the manifest, not the images.** Per image: identifier, source, SHA-256, dimensions,
>    licence. It is what makes a slice reproducible and what verifies a bundle.

The layered ignore rule that makes this work: ignore the raw corpus root and the slice image
directories, then *un-ignore* the generated placeholder images. Beware a bare `data` pattern in a
parent ignore file — git will not descend into an ignored directory, so negations inside it never
fire. That exact rule silently cost this project its golden vectors when work moved between
machines.

---

## Cross-cutting: terminology

> Build the vocabulary as a first-class artifact, not a glossary appendix.
>
> - **One identifier per concept**, chosen once and enforced. Forbid the ambiguous short form.
> - **Enum spellings are normative** and live in `contracts.md`. Lowercase, exact.
> - In bilingual material, **technical terms stay in the source language inside the other's
>   prose** — that is how the field is actually discussed in a seminar. Enumerate what stays
>   untranslated (notation, protocol names, the class vocabulary itself) in a `KEEP` list the
>   linter reads, so "we left it in English" is a recorded decision and not an omission.
> - Distinguish the **metric**, the **protocol**, and the **constraint mode**. A number without
>   all three is not a fact.

---

## Cross-cutting: the mathematical playground

The most reusable piece of this project. A single self-contained page teaching a mathematical
subject through operable instruments.

> Build one page, no build step, no dependency beyond a maths renderer. Structure:
>
> 1. **The anchor** — its stages, all its equations, its own table against the classics, its
>    results, and the limitation it states about itself.
> 2. **The mathematics** — numbered definitions and propositions. Every symbol defined before use.
>    Every derivation shown as alternating steps and justifications, so a reader can check each
>    line. Mark what is an assumption rather than a theorem, and say what would discharge it.
> 3. **A lab** where the reader supplies the input and the page computes the result.
> 4. **An inventory** of every knowledge point, clustered, filterable, each naming its control
>    surface — the actual knobs, not a description of knobs.
> 5. **Playgrounds**: one per knowledge point that can be operated, each carrying its formula, a
>    collapsible derivation, and a *what to notice* note.
>
> Rules that make it trustworthy:
> - **Synthetic data, chosen to expose one effect cleanly.** Say so. The arithmetic is exact and
>   matches the stated definitions; the values measure nothing.
> - **Every figure quoted from a paper names its table.** A figure that cannot be traced to one is
>   not carried. There is no unverified tier.
> - **Work one example by hand and check an identity on it**, so a reader can verify the engine
>   against arithmetic they can do themselves.
> - **A validator for the failure mode your renderer hides.** Here, a stray line break inside
>   display maths renders as a red error rather than failing loudly, so a linter hunts for it.
> - Cross-check the inventory against what is actually built, or an entry marked live with nothing
>   behind it fails silently.

**The pedagogical move worth stealing:** separate the two ways a prediction can fail — wrong
classification versus wrong localization — and colour them differently. The distinction is
precisely what the field's evaluation protocols exist to isolate, so showing it makes the protocols
self-explanatory.

---

## What to keep from this repository as templates

| File | Reusable as |
|---|---|
| `docs/superpowers/specs/*-decisions.md` | The decision-register format |
| `docs/superpowers/specs/*-contracts.md` | Normative names and enum spellings |
| `docs/superpowers/plans/*-00-master.md` | Master index + global constraints block |
| `DEVIATIONS.md` | Plan-departure log |
| `system/web/knowledge-map/FROZEN.md` | Freeze note + auditable corrections log |
| `data/LICENCES.md` | Two-gate licence ledger |
| `system/backend/scripts/build_golden.py` | Hand-computed fixtures with a `why` per case |
| `system/tools/parity.mjs` | Cross-implementation agreement check |
| `system/tools/audit.js`, `system/tools/check.js` | Renderer-specific and inventory-coverage linters |
| `system/tools/build_standalone.mjs` | Offline single-file build with a no-fetch guard |
| `start.ps1`, `fetch-data.ps1` | Windows front doors that delegate rather than duplicate |
