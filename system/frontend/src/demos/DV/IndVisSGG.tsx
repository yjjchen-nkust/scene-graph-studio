import { useLocale, type Locale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice } from '../../playgrounds/controls';
import { snap } from '../../playgrounds/logic';
import { DEFAULT_FRAME, FRAME_IDS, VLM, frameLabel, resolveFrame } from '../data';
import { DemoFrame } from '../DemoFrame';
import type { DemoProps } from '../mounts';
import { Part1 } from './Part1';
import { Part2 } from './Part2';
import { Part3 } from './Part3';
import { Part4 } from './Part4';
import { Part5 } from './Part5';

/**
 * The served weights and the server, as the transcript's provenance note names them ("the weights
 * Qwen/Qwen3.8-27B served by vLLM"), formatted for the locale; nothing if the note names none, so
 * the line never states a model the recording does not. In zh-TW the full-width parentheses meet
 * the next word directly, and without them a space parts the model id from 錄製.
 */
function servedBy(note: string, locale: Locale): string {
  const served = /weights (\S+) served by (\S+)/.exec(note);
  if (locale === 'zh-TW') return served ? `（${served[1]}，${served[2]}）` : ' ';
  return served ? ` (${served[1]}, ${served[2]})` : '';
}

/**
 * D-V — the anchor paper's method over the clip's ten frames, as recorded: step 1's draft under
 * the TEC prompt, three experts' revisions, step 3's summary (spec 2026-09-29-m0-demos-design
 * §3.3), one stage to a part (§4).
 *
 * 1. The TEC prompt: the clip beside the prompt's INFORMATION, O, P, E and FORMAT.
 * 2. The draft: one call's triplets in the order written, each term outside O or P flagged, beside
 *    the calls per frame and D-T's candidate count for the same frame.
 * 3. The experts: one expert's deletions, additions and rewrites against the draft, and its own
 *    analysis in the displayed locale.
 * 4. The summary: step 3's triplets as a graph, and the predicates of both pipelines.
 * 5. Over time: the three keyframes in Figure 6's marks, and both pipelines' churn per step.
 *
 * Two knobs, both in the URL, so the stepper carries them from part to part (D96): `DV.frame`, as
 * `DT.frame` is (an id the clip does not have, or none, reads as `DEFAULT_FRAME`), and
 * `DV.expert`, through `snap` onto 1 to N, so `?DV.expert=7` reads as the last expert and `abc` as
 * the first. Part 1 picks the frame through the clip's ticks; parts 2 to 4 carry it as a list;
 * part 5 always shows the three keyframes and the ten frames, so it has no knob.
 *
 * The provenance line is the transcript's own: its model, the weights its note names, its date,
 * "recorded" and "replayed". A replay is not the call, so no label here says measured (to_graph's
 * rule, which `summaryGraph` keeps). Every figure is a count, a set membership or a set
 * difference over `VLM` and `TRADITIONAL`, computed through `logic.ts`; nothing is a metric and
 * nothing imports a value from `sgg-metrics`.
 */
export function IndVisSGG({ part }: DemoProps) {
  const { t, locale } = useLocale();
  const [params, setParams] = useLabParams({ 'DV.frame': DEFAULT_FRAME, 'DV.expert': 1 });
  const id = resolveFrame(params['DV.frame']);
  // `data.test.ts` holds the artefact's frames to the manifest's ids, which `resolveFrame` keeps to.
  const frame = VLM.frames.find((f) => f.image_id === id)!;
  // N from the recording (3, as spec §3.3 has it); at least 1, so the snap has a range to land in.
  const expert = snap(params['DV.expert'], 1, Math.max(1, frame.experts.length), 1);
  const pick = (next: string) => setParams({ 'DV.frame': next });

  const frameChoice = (
    <Choice
      id="DV.frame"
      label={t('demo.frame')}
      value={id}
      options={FRAME_IDS.map((f) => ({ value: f, label: frameLabel(f) }))}
      onChange={pick}
    />
  );
  let controls = null;
  if (part === 2 || part === 4) controls = frameChoice;
  if (part === 3) {
    controls = (
      <>
        {frameChoice}
        <Choice
          id="DV.expert"
          label={t('demo.dv.expert')}
          value={String(expert)}
          options={frame.experts.map((e) => ({ value: String(e.index), label: String(e.index) }))}
          onChange={(next) => setParams({ 'DV.expert': Number(next) })}
        />
      </>
    );
  }

  const { provenance } = VLM;
  const line = t('demo.provenance_recorded')
    .replace('{date}', provenance.generated_at.slice(0, 10))
    .replace('{model}', provenance.model)
    .replace('{served}', servedBy(provenance.note_en, locale));

  return (
    <DemoFrame title={t(`demo.dv.title${part}`)} controls={controls} provenance={line}>
      {part === 1 && <Part1 frameId={frame.image_id} onPick={pick} />}
      {part === 2 && <Part2 frame={frame} />}
      {part === 3 && <Part3 frame={frame} expert={expert} />}
      {part === 4 && <Part4 frame={frame} />}
      {part === 5 && <Part5 />}
    </DemoFrame>
  );
}
