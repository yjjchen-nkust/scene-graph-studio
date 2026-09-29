import { useEffect, useRef } from 'react';
import { useLocale } from '../i18n/useLocale';
import { CLIP_FRAMES, CLIP_SIZE, CLIP_URL, KEYFRAME_IDS, SEGMENT_START } from './data';

const KEYFRAME_MARKS = ['t₁', 't₂', 't₃'];

const TICK = 'rounded border-2 px-1 font-mono text-[0.75em] leading-tight tabular-nums text-slate-900';
/** A keyframe differs by the shape of its border, not by its colour alone (NFR-5). */
const TICK_KEYFRAME = 'border-solid border-slate-900';
const TICK_OTHER = 'border-dashed border-slate-500';
/** The chosen frame is bold and underlined, which leaves every border as it is. */
const TICK_CHOSEN = 'bg-slate-200 font-bold underline decoration-2 underline-offset-2';
const TICK_UNCHOSEN = 'bg-white';

/**
 * The clip, and one button for each of the ten frames beneath it.
 *
 * A native `<video>` with the browser's own controls: muted, as the clip has no audio track;
 * inline, so a phone does not take it full screen; and `preload="metadata"`, so a lecture that
 * never plays it fetches its header and nothing more. Nothing autoplays.
 *
 * A tick seeks the clip to its frame and picks that frame, which a part holds in the URL. The
 * clip also opens on the chosen frame while paused, so the clip and the photograph beside it
 * agree when a part is entered with a frame already chosen. The lecture shell yields Space to a
 * focused clip and to a focused tick (`useStepper.ts`, `consumesSpace`), and keeps the arrows.
 */
export function ClipPlayer({
  value, onPick, maxVh,
}: { value: string; onPick: (id: string) => void; maxVh: number }) {
  const { t } = useLocale();
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const clip = video.current;
    const frame = CLIP_FRAMES.find((f) => f.image_id === value);
    if (clip && frame && clip.paused) clip.currentTime = frame.t - SEGMENT_START;
  }, [value]);

  return (
    <div
      className="min-w-0 flex-1"
      style={{ maxWidth: `calc(${maxVh}vh * ${CLIP_SIZE.width} / ${CLIP_SIZE.height})` }}
    >
      <video
        ref={video}
        data-testid="demo-clip"
        src={CLIP_URL}
        width={CLIP_SIZE.width}
        height={CLIP_SIZE.height}
        controls
        muted
        playsInline
        preload="metadata"
        className="block h-auto w-full bg-slate-900"
        style={{ maxHeight: `${maxVh}vh` }}
      />
      <div role="group" aria-label={t('demo.frame')} className="mt-1 flex flex-wrap gap-1">
        {CLIP_FRAMES.map((f) => {
          const k = KEYFRAME_IDS.indexOf(f.image_id);
          const mark = k === -1 ? undefined : KEYFRAME_MARKS[k];
          const chosen = f.image_id === value;
          return (
            <button
              key={f.image_id}
              type="button"
              data-testid={`demo-tick-${f.image_id}`}
              data-keyframe={String(mark !== undefined)}
              aria-pressed={chosen}
              title={mark === undefined ? undefined : `${t('demo.keyframe')} ${mark}`}
              onClick={() => {
                if (video.current) video.current.currentTime = f.t - SEGMENT_START;
                onPick(f.image_id);
              }}
              className={[
                TICK,
                mark === undefined ? TICK_OTHER : TICK_KEYFRAME,
                chosen ? TICK_CHOSEN : TICK_UNCHOSEN,
              ].join(' ')}
            >
              {`${f.t} s`}
              {mark !== undefined && ` ${mark}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
