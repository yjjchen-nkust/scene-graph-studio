# Reading IndVisSGG — the source document for module M11

**Status:** primary-source reading, 2026-09-16
**Purpose:** M11 is the one module whose entire source is a single paper. This document is that module's content, in the four-part shape SRS §11.2 requires, so the MDX authoring in plan 02 Task 8 is a transcription rather than a fresh reading.
**Method:** all eight pages read directly. Every figure below is quoted from the paper's own tables, with the table named. Nothing is carried over from a survey or a summary.

**Wang Zuoxu, Yan Zhijie, Li Shufei, Liu Jihong.** *IndVisSGG: VLM-based scene graph generation for industrial spatial intelligence.* Advanced Engineering Informatics **65** (2025) 103107. [doi:10.1016/j.aei.2024.103107](https://doi.org/10.1016/j.aei.2024.103107)

School of Mechanical Engineering and Automation, Beihang University; Centre for Advanced Robotics Technology Innovation, Nanyang Technological University; State Key Laboratory of Digital Manufacturing Equipment and Technology, Huazhong University of Science and Technology. Received 13 August 2024, revised 6 November 2024, accepted 31 December 2024, available online 11 January 2025.

Funded by NSFC 52205244, MIIT China Key Laboratory of Intelligent Manufacturing for High-end Aerospace Products, the Beijing Key Laboratory of Digital Design and Manufacturing, and State Key Laboratory open programme IMETKF2024010.

Under *Data availability* the paper states, in full: **"Data will be made available on request."** That single line is the whole basis for labelling ISG request-only. It is not a missing link or an oversight; it is the authors' stated position.

---

## 1 · The claim, in one paragraph

Conventional scene graph generation is a pipeline: detect objects, enumerate candidate pairs, classify the relation on each pair. Every stage needs supervision, and the relation classifier needs relationship-level annotation — which industrial footage does not have and which is expensive to create. IndVisSGG deletes the pipeline. It hands a video frame to a prompted vision-language model and asks for triplets directly, then audits the answer with further calls to the same model.

**The contribution is not architectural.** It is a claim that constraining a VLM's output vocabulary, plus a self-audit, substitutes for a trained relation head. Everything in the evaluation should be read against that claim and no other.

Three contributions are stated: the method; the **ISG** dataset (10,000 annotated industrial frames); and an evaluation of two VLMs inside the multi-agent strategy.

---

## 2 · Why the prior art fails here — the paper's own argument

§2.2 makes four specific complaints. Teach them as four, not as general dissatisfaction.

1. **Boxes are loose.** A bounding box covers pixels belonging to other objects. In overlapping regions the assignment is arbitrary.
2. **Boxes miss unbounded regions.** The paper's own example is a road area — critical to understanding the scene, and not a boxable object.
3. **Box annotation carries junk.** Multiple markings of trees and sky contribute nothing and produce isolated nodes. Learning from these confuses the model.
4. **Panoptic SGG fixes 1–3 and creates a new problem.** Per-pixel labelling is more faithful but far more expensive, and — in the paper's own words — in some PSG datasets **the top three relationship categories account for over 50% of samples, while many rare relations occupy less than 1%**.

Point 4 is the one to dwell on. It is the long-tail problem stated by the authors of the method under study, and it is exactly what `mR@K` exists to expose. A student who sees it here will understand M4 and M6 differently.

---

## 3 · The data model

### Intuition
A scene graph is a directed labelled multigraph over the things visible in a frame. For video you additionally have to say *when* each edge held, because an edge that appears and disappears is either an event or detector noise, and only time distinguishes them.

### Formal statement

$$G = (V,\ E,\ T)$$

| Symbol | Meaning |
|---|---|
| $G$ | the ground-truth scene graph |
| $V$ | the node set — subjects and objects: industrial parts, people, machines |
| $E$ | the edge set — predicates, the spatial and interactive relations |
| $T$ | the time span the graph covers |
| $t$ | a timestamp, $t \in T$ |
| $V_t$ | the **vision information** at timestamp $t$: the video frame |

**A notation trap the paper does not flag.** $V$ is the node set; $V_t$ is an image. They are unrelated, and $V_t$ is not "the nodes at time $t$". A reader who assumes otherwise will misread §3.1 completely. Define both before either appears in the lecture.

The unit of prediction is the triplet

$$\langle \textit{subject}_t,\ \textit{predicate}_t,\ \textit{object}_t \rangle$$

subject and object being entities, the predicate describing their spatial or interactive relation at timestamp $t$.

### Worked example
From the paper's Figure 6, tracking one human–robot collaboration across three timestamps:

- **$t_1$** — `robot-beside-person`, `person-using-laptop`, `laptop-on-table`, `robot-attached to-table`.
- **$t_2$** — the `beside` edge between person and box is removed.
- **$t_3$** — the `box` node disappears entirely, and a `holding` edge appears between person and laptop.

In the paper's own figure, dotted lines mark disappeared edges and nodes; blue lines mark newly added ones.

### Implications
Because $T$ sits in the signature, running an image model once per frame is not a solution. It produces a sequence of unrelated graphs with no account of which changes are real. This is the argument for the whole temporal framing, and it is why L2's semi-constraint mode (Action Genome) exists in the wider literature.

---

## 4 · The method, equation by equation

Three phases, **five agents** in total. The prompt has three named parts throughout: **INFORMATION** (the meaning and characteristics of the scene graph), **TRIPLETS EXTRACTION CRITERIA** (the criteria for extracting entities), and **FORMAT**.

### 4.1 · Equation (1) — the naive call

**Intuition.** Ask the model for triplets with nothing but an instruction.

**Formal statement.**

$$out_{trpl} = VLM(V_t,\ \textit{Prompt}) \tag{1}$$

where $VLM(\cdot)$ denotes the vision-language model — GPT-4V in the main experiments — treated as an operator, not a trained component.

**Worked example.** The paper's illustration of the failure: a plain instruction such as "extract triplets from images and organize them in the ⟨subject, predicate, object⟩ format".

**Implications.** The paper's own assessment: this "can generate numerous triplets", but "due to the unrestricted nature of the extracted triplets, there is significant diversity in the selection of entities and predicates. While these entities and predicates are similar to the ground truth, variations in their expressions can lead to suboptimal results."

Read that twice. **The model is not wrong about the scene.** It is wrong about the vocabulary, and recall is computed by string identity, so a correct observation phrased differently scores zero. This is the single most important sentence in the paper for a student who has just learned `R@K`.

### 4.2 · Equation (2) — the Triplets Extraction Criteria

**Intuition.** Hand the model the dictionary before asking it to write.

**Formal statement.**

$$out^{s_1}_t = VLM(V_t,\ O,\ P,\ E,\ \textit{Prompt}) \tag{2}$$

| Symbol | Meaning |
|---|---|
| $O$ | the predefined **object** dictionary |
| $P$ | the predefined **predicate** dictionary |
| $E$ | **examples**, positive and negative, each carrying its own analysis and concluding with an overall analysis |
| $out^{s_1}_t$ | the output of step 1 at timestamp $t$ |

**Worked example — the paper's own vocabularies, from Figure 2.**

*Predefined objects:* beam, bearing, bolt, box, caliper, cylinder, conveyor, nut, piston, panel, spring, ring, robot arm, tool, table, terminal, wheel, wrench, …

*Predefined predicates:* above, along, attached to, behind, belonging to, between, carrying, covering, hanging from, goes through, knocking on, meshed with, on, picking up, screw, wrapping, …

**Implications.** TEC's stated purpose is precise and worth quoting in class: it "thoroughly annotates entities with sentences, avoiding pronouns and instead replacing them with specific, predefined object categories", then "enables VLMs to predict object relationships by selecting the most relevant terms from these dictionaries, ensuring each triplet contains clear entities and predicates."

$O$ and $P$ are therefore **not hints**. They are a projection of free-text output onto a closed vocabulary, applied *before* generation rather than after. Whether the "before" matters is the paper's untested assumption — see §9.

### 4.3 · Equation (3) — triple-checking across temporal domains

**Intuition.** Step 1's output contains noise. Show it back to the same model several times independently, with the frame still in hand, and ask each copy to audit it.

**Formal statement.**

$$\left(out^{s_2}_t,\ a_i\right) = VLM\!\left(V_t,\ O,\ P,\ E,\ \textit{Prompt},\ out^{s_1}_t\right), \qquad i \in \{1,2,3\} \tag{3}$$

| Symbol | Meaning |
|---|---|
| $a_i$ | expert $i$'s **analysis** — the natural-language justification accompanying its revision |
| $out^{s_2}_t$ | the revised triplet set |
| $N$ | the number of experts; $N = 3$ in all reported experiments |

**Worked example — the three named corrections, from Figure 2b.** Each is a *different kind* of error, and that is why there are three of them:

| Expert | Error class | What it does |
|---|---|---|
| $\text{Expert}_1$ | **Hallucination** | Identifies the absence of `wrench` in $V_{t_1}$ — the triplet names an entity not in the frame — and deletes it |
| $\text{Expert}_2$ | **Omission caused by $O$** | Adds undetected triplets: `(terminals, on, conveyor)`, `(beam, on, robot arm)`, `(panel, on, table)`. These nodes were missing from the object dictionary, which suppressed them |
| $\text{Expert}_3$ | **Vocabulary violation** | Rewrites the imprecise `taping` to `knocking on`, because `taping` is not in $P$ |

**Implications, and a proof obligation the paper leaves open.** No theory is offered for why $N$ independent audits help. A plausible model: if each audit corrects a given error independently with probability $q$, the error's survival probability is $(1-q)^N$ — exponential in $N$ — while cost is $N+2$ VLM calls, linear in $N$.

**That reconstruction is ours, not the paper's**, and it rests on an independence assumption that is plainly false: three samples from one model on one frame are correlated. Presenting it as the paper's reasoning would be a misattribution. Present it as the hypothesis a student should try to break.

### 4.4 · Equation (4) — summarizing

**Intuition.** Reconcile the experts into one graph, with their reasoning available to the reconciler.

**Formal statement.**

$$out^{s_3}_t = VLM\!\left(out^{s_2}_t,\ \alpha,\ \textit{Prompt}\right), \qquad \left\{out^{s_2}_t, \alpha\right\} = \left\{out^{s_2}_t,\ a_i \mid i \in \{1,2,3\}\right\} \tag{4}$$

where $\alpha$ collects the experts' analyses.

**Implications.** The paper notes that in this step the model "pays attention to the given $O$, $P$, and $E$, ensuring that all results are in a format that satisfies the rules specified by TEC". The dictionaries are enforced three times over — at generation, at audit, and at summary. That redundancy is itself a design claim and is never ablated.

---

## 5 · The evaluation, and the trap inside it

**Formal statement.** The paper gives one metric equation, its (5):

$$R@K = \left|\, Top_K \cap GT \,\right| \big/ \left|\, GT \,\right| \tag{5}$$

| Symbol | Meaning |
|---|---|
| $Top_K$ | the $K$ highest-scoring predicted triplets |
| $GT$ | the ground-truth triplet set for that image |

and defines mean Recall verbally: *"meanRecall@K calculates Recall@K for each predicate individually and then averages these values across all predicates."*

**The trap.** The $\cap$ is **not set intersection**. The match relation is not an equivalence relation — it is not transitive, and two distinct predictions can both match the same ground-truth triplet. What the quantity denotes is the size of a maximum partial injection between $Top_K$ and $GT$; every implementation approximates it greedily in score order.

The paper does not say this. Neither does most of the literature it cites. It is precisely the gap Lorenz et al. (CVPRW 2024) identified as the reason published implementations disagree with one another, and it is why this project's engine was written test-first from a formal statement rather than from a verbal one.

**Implications.** $R@K$ and $mR@K$ average the *same* per-predicate recalls under different weights — frequency weighting $n_p/|GT|$ for $R$, uniform $1/|\mathcal{P}'|$ for $mR$, where $n_p$ is the ground-truth count of predicate $p$ and $\mathcal{P}'$ the set of predicates actually present. Nothing else differs, and the whole long-tail argument reduces to the sign of one covariance. That identity is knowledge point `E6`, and it should be taught before this paper, not after.

---

## 6 · Results — Table 2

All figures are the paper's own, from Table 2. MOTIFS, FREQ and VCTREE are reported from the re-implemented version. Test conditions: VG-150 sampled one image from every 26 of the valid test set, ≈1018 images; PSG split 3:1 train/test, 2186 test images.

**Visual Genome (VG-150)**

| Method | Input | R@20 | mR@20 | R@50 | mR@50 | R@100 | mR@100 |
|---|---|---|---|---|---|---|---|
| FCSGG | Vision | 16.1 | 2.7 | 21.3 | 1.6 | 25.1 | 4.2 |
| MOTIFS | Vision | 21.4 | 6.6 | 27.2 | 8.2 | 30.3 | 15.3 |
| FREQ | Vision | 20.1 | 7.1 | 26.2 | 8.5 | 30.1 | 16.0 |
| RelTR | Vision | 21.2 | 6.8 | 27.5 | 10.8 | – | – |
| VCTree | Vision | 22.0 | 8.0 | 27.9 | 10.8 | 31.3 | 19.4 |
| **IndVisSGG** | Vision + Prompts | **23.29** | **12.98** | **30.48** | **21.39** | **32.36** | **21.99** |

**PSG**

| Method | Input | R@20 | mR@20 | R@50 | mR@50 | R@100 | mR@100 |
|---|---|---|---|---|---|---|---|
| IMP | Vision | 17.9 | 7.35 | 19.5 | 7.88 | 20.1 | 8.02 |
| GPSNet | Vision | 18.4 | 6.52 | 20.0 | 6.97 | 20.6 | 7.17 |
| PSGFormer | Vision | 18.0 | 14.8 | 19.6 | 17.0 | 20.1 | 17.6 |
| MOTIFS | Vision | 20.9 | 9.60 | 22.5 | 10.1 | 23.1 | 10.3 |
| VCTree | Vision | 21.7 | 9.68 | 23.3 | 10.2 | 23.7 | 10.3 |
| **IndVisSGG** | Vision + Prompts | **23.26** | **16.25** | **29.69** | **25.12** | **30.34** | **25.62** |

**ISG**

| Method | Input | R@20 | mR@20 | R@50 | mR@50 | R@100 | mR@100 |
|---|---|---|---|---|---|---|---|
| IndVisSGG-Gemini | Vision + Prompts | 13.90 | 14.24 | 16.64 | 15.10 | 17.02 | 15.36 |
| **IndVisSGG** (GPT-4V) | Vision + Prompts | **17.68** | **14.51** | **24.88** | **22.53** | **28.73** | **28.64** |

### How to read these three tables

**0 · The paper names no protocol, so neither may we.** SGDet, PredCls and SGCls do not occur in the text, nor does any statement about graph constraint. §5.1.3 says: *“In the VG and PSG experiments, both $O$ and $P$ are predetermined for all methods. Unlike IndVisSGG, other methods require additional object annotations in the images using either bounding boxes or panoptic segmentation.”* Objects predetermined for every method is the opposite of detection, so SGDet in particular is excluded; whether the intended setting is PredCls or SGCls the paper does not say. Every figure in this section is therefore carried as `protocol: unstated, constraint: unstated`. An earlier pass tagged all eighty-two of them `sgdet`/`graph`, which this section's silence did nothing to prevent — see DEVIATIONS D34.

**1 · The mR gains dwarf the R gains, and that is the real evidence.** On VG, mR@50 improves by 9.19 against R@50's 2.58; on PSG, mR@50 improves by 8.12 against R@50's 6.39. A method that lifts mean Recall far harder than Recall is recovering *tail* predicates. That is consistent with the claimed mechanism: a fixed dictionary $P$ gives a rare predicate the same access to the output as a common one, which a frequency-trained classifier never does. If you teach one thing from Table 2, teach this.

**2 · GPT-4V beats Gemini-Pro-Vision on ISG at every cutoff**, and the gap widens with $K$ — 3.78 points of R@20 becoming 11.71 points of R@100. The paper attributes nothing to this; it is an uncontrolled comparison of two proprietary models at two moments in time.

**3 · Do not compare across the three datasets.** Different splits, different vocabularies, different image sources. The three blocks are three separate experiments that happen to share a row label.

---

## 7 · The ablations

### Table 3 — components of TEC, on 10% of the PSG test set

**This is a five-row factorial over $(O, P, E\&\text{Analysis})$, not a cumulative sequence.** Rows 2 and 3 are single-component ablations: $O$ alone, then $P$ alone.

| $O$ | $P$ | $E$&Analysis | R@20 | mR@20 | R@50 | mR@50 | R@100 | mR@100 |
|---|---|---|---|---|---|---|---|---|
| ✗ | ✗ | ✗ | 0.032 | 0.014 | 0.041 | 0.027 | 0.055 | 0.039 |
| ✓ | ✗ | ✗ | 1.787 | 0.378 | 3.195 | 2.645 | 3.272 | 2.652 |
| ✗ | ✓ | ✗ | 2.079 | 1.122 | 3.563 | 1.975 | 3.955 | 2.678 |
| ✓ | ✓ | ✗ | 20.792 | 16.538 | 28.188 | 21.673 | 29.038 | 22.046 |
| ✓ | ✓ | ✓ | 23.040 | 17.250 | 29.785 | 27.375 | 30.147 | 27.680 |

**Four observations, in order of importance.**

**a · Row 1 is the headline.** `R@20 = 0.032` means a frontier VLM, asked plainly, scores essentially zero. It is not blind — it describes the scene correctly. It fails the string match. The ratio from row 1 to row 5 is $23.040 / 0.032 = 720$, with **the same operator, the same image, and the same prompt template**. The only varying argument is $(O, P, E)$.

**b · The jump is superadditive, and the paper does not remark on it.** $O$ alone gives 1.787. $P$ alone gives 2.079. Together they give 20.792 — an order of magnitude beyond either, and beyond their sum. **Constraining one end of the triplet is nearly worthless; constraining both is transformative.** This is the most interesting quantitative fact in the paper and it is not discussed in the text. It is also the thing a four-row cumulative reading destroys, which is why this document spells the table out in full.

**c · The paper's own reading of rows 2 and 3.** *"Providing $P$ alone leads to better outcomes than supplying $O$ alone… because predicting relations is often more challenging than forecasting object categories."* Defensible, but note it rests on a 0.292-point difference at R@20 on a 10% subset.

**d · Examples-with-analysis is a tail intervention.** It adds 2.248 points at R@20 but 5.702 at mR@50. Consistent with observation 1 of §6.

### Table 4 — number of experts

| $N$ | R@20 | mR@20 | R@50 | mR@50 | R@100 | mR@100 |
|---|---|---|---|---|---|---|
| 1 | 21.323 | 15.400 | 23.530 | 18.701 | 24.431 | 24.920 |
| 2 | 21.584 | 16.428 | 25.371 | 19.247 | 26.541 | 25.396 |
| 3 | 23.158 | 16.947 | 28.447 | **25.480** | **30.142** | 27.031 |
| 5 | **23.287** | **17.890** | **28.754** | 24.383 | 30.020 | **27.591** |

The paper concludes: *"three experts proved to be the optimal number, achieving high accuracy in predicting triplets while minimizing token usage in VLM models."*

**Read this carefully, because the data is mixed and the obvious summary is wrong.** Going from 3 to 5 experts improves R@20, mR@20, R@50 and mR@100, but **degrades mR@50 (25.480 → 24.383) and R@100 (30.142 → 30.020)**. So $N=3$ is **not dominated**, and the recommendation rests on more than token cost.

A lab that displays only the `@20` column would show $N=5$ winning on both axes and teach the opposite of what the data says. Plan 03 therefore commits all four rows at all six cutoffs, with a test asserting the two cutoffs where $N=5$ loses.

The marginal return from $1 \to 3$ is large and monotone; from $3 \to 5$ it is small and inconsistent in sign. That shape — steep then flat and noisy — is what a variance-reduction mechanism looks like when it saturates, which supports the paper's choice without supplying the theory it lacks.

---

## 8 · The ISG dataset

**Construction, in three steps as the paper describes them.**

1. **Data collection** from five sources, with the top ten triplets labelled.
2. **Concise object category and predicate dictionary** — a VLM extracts noisy scene graphs from image inputs alone, and representative objects and predicates are then automatically extracted from those noisy graphs by open-vocabulary LLMs.
3. **Rigorous annotation** — manual: filtering out incorrect triplets; adding and modifying representative objects and predicates to align with $O$ and $P$; then manual verification of the refined graphs.

**Sources:** CHICO (Cobots and Humans in Industrial Collaboration), Ego4D (egocentric), HA-ViD (industrial parts assembly), IKEA ASM (furniture assembly), CALVIN (robot visuomotor manipulation).

**Table 1 — the comparison that justifies it.** PPI counts predicates per image; DupFree indicates whether duplicated object groundings are cleaned up; IIS indicates whether industrial scenes are included.

| Dataset | Images | ObjCls | RelCls | PPI | DupFree | IIS | Source |
|---|---|---|---|---|---|---|---|
| VG | 108K | 34K | 40K | 21.4 | ✗ | ✗ | COCO & Flickr |
| VG-150 | 88K | 150 | 50 | 5.7 | ✗ | ✗ | Clean VG |
| VrR-VG | 59K | 1600 | 117 | 3.4 | ✗ | ✗ | Clean VG |
| GQA | 85K | 1703 | 310 | 50.6 | ✓ | ✗ | Re-annotate VG |
| PSG | 49K | 133 | 56 | 5.7 | ✓ | ✗ | Annotate COCO |
| **ISG (ours)** | **10K** | **688** | **144** | **17.6** | **✓** | **✓** | HA-ViD, IKEA, Ego4D, et al. |

**The argument is density, not scale.** ISG is a fifth of PSG's size but carries three times the predicate density (17.6 against 5.7) over five times the object vocabulary (688 against 133), and it is the only row with a tick in the industrial column. The claimed distinction is "more detailed and precise graph annotations".

---

## 9 · What the paper does not establish

State these explicitly. They are where the work is honest, and where it is thin.

**The backbone is uncontrolled, and the paper says so.** Its stated limitation: *"IndVisSGG was tested on VLM models such as GPT-4V and Gemini-Pro-Vision. The backbone of different VLMs may influence SGG performance on industrial tasks."* Both models are now superseded and neither is reproducible at the version tested. Every number in Table 2's IndVisSGG rows is a measurement of a model that no longer exists in that form.

**No theory for $N$.** §4.3. The independence assumption is untested and is almost certainly false.

**The ablation's baseline may be unfairly weak — the most serious methodological gap.** Row 1 of Table 3 uses an unconstrained prompt. A stronger naive baseline exists and is not reported: free-text output followed by nearest-neighbour projection onto $O$ and $P$ *after* generation. Without it, Table 3 conflates two claims — "constraining the vocabulary helps" and "constraining it *before* generation helps" — and only the second is the method. A student who runs that missing experiment in L5 has done something the paper did not.

**Cross-method comparability.** Table 2's baselines come from the paper's own re-implementations, and the paper states neither their detector backbones nor their epoch budgets. It also names no evaluation protocol and no constraint mode anywhere: SGDet, PredCls and SGCls do not occur in the text, and §5.1.3 says only that both $O$ and $P$ are predetermined for all methods. So the columns cannot be shown to be comparable, which is a stronger statement than saying they differ. This is a field-wide problem rather than this paper's alone, and it is exactly why this project renders per-paper tables with a non-comparability banner and never merges them into one ranking.

**ISG is request-only.** No public release, no repository, and the data-availability statement commits only to release on request. Our mini-ISG is built by the same method from openly licensed frames and is labelled unambiguously as *our* teaching set.

---

## 10 · Notes for the M11 author

**Curriculum position.** M11 is eleventh deliberately. By that point the student holds the triplet model (M1), grounding (M2), the three protocols (M3), the metrics and the frequency baseline (M4), the two-stage lineage (M5), the bias problem (M6), the one-stage lineage (M7), and the open-vocabulary framing (M9). Every one of those is load-bearing here: without M4 the student cannot see why row 1 of Table 3 is 0.032 rather than evidence of a blind model, and without M6 they cannot see why the mR gains matter more than the R gains.

**The one-sentence thesis to open with.** *A frontier VLM asked plainly for scene-graph triplets scores 0.032 on R@20 — not because it cannot see, but because it does not know which words are allowed.*

**Knowledge points to attach:** `L8` (equations 1 and 2, and the ablation), `L9` (equations 3 and 4, and the expert count), `L10` (the out-of-vocabulary predicate costing twice — a false positive *and* a miss).

**The lab.** L5 replays Tables 3 and 4 beside the student's own run. Plan 03 requires the published figures and the student's figures to be returned in separate fields and never rendered inside one element.

**Two errors this reading corrected** in material already committed, recorded in `system/web/knowledge-map/FROZEN.md` and `DEVIATIONS.md` D16: the claim that $N=5$ beats $N=3$ "on both axes" (true only at $k=20$), and Table 3 presented as a four-row cumulative sequence (it is a five-row factorial, and the omitted $P$-alone row is what makes the superadditivity visible). Neither was catchable by any automated check, because every number was real and correctly transcribed. Only the sentences around them were wrong.
