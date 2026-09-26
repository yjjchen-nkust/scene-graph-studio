import { useId } from 'react';
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { PlaygroundFrame, Readout, Slider } from '../controls';
import { placeholderImageUrl } from '../images';
import { area, intersection, ratio, scaleBound, scaledBox, snap, unionArea } from '../logic';
import type { PlaygroundProps } from '../mounts';
import { frameById } from '../slice';
import { F3_FRAME, F3_OBJECT, F3_RANGES, XU_TAU } from './setup';

/** The photograph's height at most, in viewport heights, so the step fits 1024×768. */
const PICTURE_VH = 34;

const COUNT = new Intl.NumberFormat('en-US');

const GT_STROKE = '#0f172a';
const PRED_STROKE = '#b45309';

/**
 * F3 — 以 box 定位；IoU.
 *
 * One annotated box and a prediction the student moves and scales. M2 s2 derives that
 * IoU ≤ min(A, A′) / max(A, A′) before any question of placement, so past λ = √2 no position
 * reaches τ = 0.5; here λ = 1.4 still reaches it concentric and λ = 1.5 never does.
 *
 * Computes two pixel counts, their quotient, the bound and one set membership, IoU ≥ τ. No
 * metric: the recall the IoU feeds is scored in L2. The membership is worded as F8's is, counted
 * or not counted as the same object, never right or wrong, because s2 says a rejected box may sit
 * at a different, defensible place.
 *
 * The marks differ in shape as well as colour (NFR-5): solid for the annotation, dashed for the
 * prediction, hatched for what they share.
 *
 * Two parts (D96): the box moved and counted, then the threshold and the membership, with the IoU
 * and the bound it is compared against. As one step it ran 171 px past a 1024×768 panel.
 * Mounted without a part, as its unit tests and the study shell mount it, it is both.
 */
export function BoxOverlap({ part }: PlaygroundProps = {}) {
  const { t } = useLocale();
  const hatch = `${useId().replace(/:/g, '')}-hatch`;
  const [params, setParams] = useLabParams({
    'F3.dx': 0,
    'F3.dy': 0,
    'F3.lambda': 1,
    'F3.tau': XU_TAU,
  });

  const dx = snap(params['F3.dx'], ...F3_RANGES.dx);
  const dy = snap(params['F3.dy'], ...F3_RANGES.dy);
  const lambda = snap(params['F3.lambda'], ...F3_RANGES.lambda);
  const tau = snap(params['F3.tau'], ...F3_RANGES.tau);

  // Committed data, pinned by `logic.test.ts`: object 3 of ph-001 is 90 × 70 at (250, 240).
  const frame = frameById(F3_FRAME)!;
  const annotated = frame.objects.find((o) => o.object_id === F3_OBJECT)!;
  const gt = annotated.bbox;
  const pred = scaledBox(gt, dx, dy, lambda);
  const shared = intersection(gt, pred);
  const inter = shared ? area(shared) : 0;
  const union = unionArea(gt, pred);
  const iou = ratio(inter, union);
  const bound = scaleBound(gt, pred);
  const small = Math.min(area(gt), area(pred));
  const large = Math.max(area(gt), area(pred));
  const member = iou >= tau;
  const unreachable = bound < tau;
  const placement = part !== 2;
  const threshold = part !== 1;

  const controls = (
    <>
      {placement && (
        <>
          <Slider
            id="F3.dx"
            label={t('playground.f3.dx')}
            value={dx}
            min={F3_RANGES.dx[0]}
            max={F3_RANGES.dx[1]}
            step={F3_RANGES.dx[2]}
            onChange={(next) => setParams({ 'F3.dx': next })}
            valueLabel={`${dx} px`}
          />
          <Slider
            id="F3.dy"
            label={t('playground.f3.dy')}
            value={dy}
            min={F3_RANGES.dy[0]}
            max={F3_RANGES.dy[1]}
            step={F3_RANGES.dy[2]}
            onChange={(next) => setParams({ 'F3.dy': next })}
            valueLabel={`${dy} px`}
          />
          <Slider
            id="F3.lambda"
            label={t('playground.f3.lambda')}
            value={lambda}
            min={F3_RANGES.lambda[0]}
            max={F3_RANGES.lambda[1]}
            step={F3_RANGES.lambda[2]}
            onChange={(next) => setParams({ 'F3.lambda': next })}
            valueLabel={lambda.toFixed(1)}
          />
        </>
      )}
      {threshold && (
        <>
          <Slider
            id="F3.tau"
            label={t('playground.f3.tau')}
            value={tau}
            min={F3_RANGES.tau[0]}
            max={F3_RANGES.tau[1]}
            step={F3_RANGES.tau[2]}
            onChange={(next) => setParams({ 'F3.tau': next })}
            valueLabel={tau.toFixed(2)}
          />
          <span className="text-[0.875em] text-slate-700">{t('playground.f3.tau_origin')}</span>
        </>
      )}
    </>
  );

  return (
    // Unclipped: the readouts and the membership stand beside the picture, and a word under the
    // clip is beyond the step's scroll (D93).
    <PlaygroundFrame title="F3" controls={controls} clip={false}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {placement && (
          <div
            data-testid="f3-picture"
            className="min-w-0 flex-1"
            style={{ maxWidth: `calc(${PICTURE_VH}vh * ${frame.width} / ${frame.height})` }}
          >
            {/* The overlay must have the photograph's box exactly, since its viewBox is the frame's
                own 640 × 480. This wrapper is that box: the photograph is in flow and sets its height,
                and nothing else is inside it. The overlay once filled the stretched column instead,
                and `meet` scaling centred every mark 122 px below its object. An overlay of
                absolutely positioned children alone would render 0×0, which is what hid F1's
                photograph until D96. */}
            <div className="relative">
              <img
                src={placeholderImageUrl(frame.image_id)}
                alt={t('playground.f3.picture')}
                className="block w-full"
              />
              <svg
                viewBox={`0 0 ${frame.width} ${frame.height}`}
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <defs>
                  <pattern id={hatch} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="10" stroke={GT_STROKE} strokeWidth="4" />
                  </pattern>
                </defs>
                {shared && (
                  <rect
                    data-testid="f3-inter"
                    x={shared.x}
                    y={shared.y}
                    width={shared.w}
                    height={shared.h}
                    fill={`url(#${hatch})`}
                    fillOpacity={0.55}
                  />
                )}
                <rect
                  data-testid="f3-gt"
                  x={gt.x}
                  y={gt.y}
                  width={gt.w}
                  height={gt.h}
                  fill="none"
                  stroke={GT_STROKE}
                  strokeWidth={4}
                />
                <rect
                  data-testid="f3-pred"
                  x={pred.x}
                  y={pred.y}
                  width={pred.w}
                  height={pred.h}
                  fill="none"
                  stroke={PRED_STROKE}
                  strokeWidth={4}
                  strokeDasharray="12 7"
                />
              </svg>
            </div>
            <p data-testid="f3-caption" className="mt-1 font-mono text-[0.875em] text-slate-700">
              {`${frame.image_id} · ${annotated.names[0]} #${annotated.object_id}`}
            </p>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 gap-4">
            {placement && (
              <>
                <Readout
                  id="F3.intersection"
                  label={t('playground.f3.intersection')}
                  value={COUNT.format(inter)}
                  note={shared ? `${shared.w} × ${shared.h}` : '0'}
                />
                <Readout
                  id="F3.union"
                  label={t('playground.f3.union')}
                  value={COUNT.format(union)}
                  note={`${COUNT.format(area(gt))} + ${COUNT.format(area(pred))} − ${COUNT.format(inter)}`}
                />
              </>
            )}
            <Readout
              id="F3.iou"
              label={t('playground.f3.iou')}
              value={iou.toFixed(3)}
              note={`IoU = ${COUNT.format(inter)} / ${COUNT.format(union)}`}
            />
            <Readout
              id="F3.bound"
              label={t('playground.f3.bound')}
              value={bound.toFixed(3)}
              note={`${COUNT.format(small)} / ${COUNT.format(large)}`}
            />
          </div>
          {/* Beside the readouts rather than under the picture: there it made the picture column the
              taller one, and part 1 ran 33 px past a 1024×768 panel. */}
          {placement && (
            <p data-testid="f3-legend" className="text-[0.875em] text-slate-700">
              {t('playground.f3.legend')}
            </p>
          )}
          {threshold && (
            <>
              <p
                data-testid="f3-member"
                className={member ? 'text-[1.5em] text-emerald-900' : 'text-[1.5em] text-slate-700'}
              >
                {t(member ? 'playground.f3.member' : 'playground.f3.not_member')}
              </p>
              {unreachable && (
                <p data-testid="f3-unreachable" className="text-[1em] text-slate-700">
                  {t('playground.f3.unreachable')}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </PlaygroundFrame>
  );
}
