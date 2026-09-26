import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

/** Contracts §2.4. `/lecture/notes` subscribes; nothing else may name this string. */
export const PRESENTER_CHANNEL = 'sgs-presenter';

export interface PresenterMessage {
  moduleId: string;
  stepIndex: number;
  /** `null` where the step declares no `seconds_budget`, so the presenter shows no clock. */
  remainingSeconds: number | null;
}

/**
 * The presenter window's one outbound message: "is a lecture running, and where is it?"
 *
 * `BroadcastChannel` retains nothing, so a subscriber that arrives after the last message hears
 * silence. The shell posts on entering a step and on each tick of the section clock, and a step
 * with no `seconds_budget` has no clock — so on such a step the shell posted once and a window
 * opened afterwards waited for ever. Every module opens on a step with no budget, which made
 * that the ordinary case rather than a corner. See DEVIATIONS D86.
 *
 * This is a query, not a command. The presenter window still cannot drive the deck, which is the
 * property `PresenterWindow`'s own docstring is about.
 *
 * It carries `kind` and the position message does not, so the two are told apart without
 * altering the position shape that contracts §2.4 fixes.
 */
export interface PresenterHello {
  kind: 'hello';
}

export type PresenterSignal = PresenterMessage | PresenterHello;

/** Whether a signal off the channel is the presenter window asking where the lecture is. */
export function isPresenterHello(signal: unknown): signal is PresenterHello {
  return typeof signal === 'object' && signal !== null && (signal as PresenterHello).kind === 'hello';
}

/** The part of `ModuleStep` a stepper needs. Deliberately not `ModuleStep`: no React here. */
export interface StepperStep {
  id: string;
  seconds_budget?: number;
  /** The knowledge point a playground step mounts; two steps sharing one are parts of it. */
  kp?: string;
}

export interface Stepper {
  index: number;
  count: number;
  remainingSeconds: number | null;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
}

/**
 * A key pressed inside a text field belongs to the field.
 *
 * L5's TEC editor and L7's caption box both live inside a lecture step, so Space and the arrows
 * are ordinary typing there. The check reads the event's own target rather than
 * `document.activeElement` alone, because a key can be dispatched at an element that is not
 * focused, and a lecture that skips a slide when the professor types a space is the kind of
 * defect that is found in the room rather than in review.
 */
function isTextEntry(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  // `isContentEditable` is the browser's answer and covers descendants, but jsdom implements it
  // as a constant `false`, so a test written against it alone would pass for the wrong reason.
  // The attribute walk gives the same answer in both, and `contenteditable="false"` is a region
  // that explicitly opted out.
  if (node.isContentEditable) return true;
  if (node.closest('[contenteditable]:not([contenteditable="false"])') !== null) return true;
  return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT';
}

/**
 * An element that would itself act on Space.
 *
 * Space is two keys in one: "next slide" to the deck and "activate" to whatever has focus. A
 * professor who tabs to the presenter button and presses Space must get one of those, not both —
 * a second window *and* a skipped slide. An arrow means nothing to a button, so it stays the
 * deck's; the rule is about the key the focused element consumes, not about focus as such.
 */
function consumesSpace(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  if (node.tagName === 'BUTTON' || node.tagName === 'SUMMARY') return true;
  if (node.tagName === 'A' && node.hasAttribute('href')) return true;
  if (node instanceof HTMLInputElement) {
    return ['button', 'submit', 'reset', 'checkbox', 'radio', 'file'].includes(node.type);
  }
  return false;
}

function clamp(value: number, count: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), Math.max(count - 1, 0));
}

/**
 * The lecture's position, its keyboard policy and its clock.
 *
 * Position lives in the route, per contracts §2.2, and nowhere else. A copy in `useState` would
 * be a second source of truth, and the bug that follows is always the same: the slide is right
 * and the address bar is stale, so the link the professor puts on the projector opens somewhere
 * different for the student who pastes it.
 *
 * The clock counts the step's `seconds_budget` down and does not stop at zero — a section that
 * has run long is information the presenter window needs, and a timer that halts at zero hides
 * exactly how long.
 */
export function useStepper(moduleId: string, steps: StepperStep[]): Stepper {
  const params = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const count = steps.length;
  const index = clamp(Number(params.stepIndex), count);
  const budget = steps[index]?.seconds_budget ?? null;

  /**
   * Where the deck is, counting a navigation that has been asked for and not yet rendered.
   *
   * A held arrow key repeats about thirty times a second and React does not commit that fast, so
   * two presses were being computed from the same rendered index and the deck moved one step for
   * two presses. The Playwright walkthrough of M04 found it; no unit test had, because every unit
   * test waited for a render between presses.
   *
   * Both refs are assigned during render rather than in an effect, so a handler that runs between
   * the commit and the effect phase still reads the fresh value. The reconciliation has two
   * cases: the route arrived where we asked, or it moved somewhere else — a bookmark, or the back
   * button — in which case the route wins and whatever we asked for is abandoned.
   */
  const posRef = useRef(index);
  const pendingRef = useRef<number | null>(null);
  if (pendingRef.current === index || posRef.current !== index) pendingRef.current = null;
  posRef.current = index;

  const goTo = useCallback(
    (next: number) => {
      const target = clamp(next, count);
      if (target === (pendingRef.current ?? posRef.current)) return;
      // The knobs live in the query (contracts §2.2). Between two parts of one playground they are
      // the same knobs, so they cross; anywhere else a step opens on its own defaults, as before.
      const from = steps[pendingRef.current ?? posRef.current]?.kp;
      const carry = from !== undefined && from === steps[target]?.kp ? search : '';
      pendingRef.current = target;
      navigate(`/lecture/m/${moduleId}/${target}${carry}`);
    },
    [count, moduleId, navigate, search, steps],
  );

  const step = useCallback(
    (delta: number) => goTo((pendingRef.current ?? posRef.current) + delta),
    [goTo],
  );

  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => step(-1), [step]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // A modified arrow is the browser's: Alt+Left is Back, and Cmd+Right is end-of-line.
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTextEntry(event.target) || isTextEntry(document.activeElement)) return;

      const space = event.key === ' ' || event.key === 'Spacebar';
      if (space && (consumesSpace(event.target) || consumesSpace(document.activeElement))) return;

      if (event.key === 'ArrowRight' || space) {
        event.preventDefault();
        next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prev();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [next, prev]);

  // Seconds elapsed in the current step. A counter rather than a timestamp, so the countdown is
  // driven by the same clock the tests advance and cannot drift with the wall clock.
  //
  // The counter carries the step it was counting, and a reading for a different step is read as
  // zero during render. Clearing it from an effect instead would work and would also put one
  // render of the previous step's number on the projector before the correction arrived.
  const stepKey = `${moduleId}:${index}`;
  const [clock, setClock] = useState({ stepKey, seconds: 0 });
  const elapsed = clock.stepKey === stepKey ? clock.seconds : 0;

  useEffect(() => {
    if (budget === null) return;
    const id = setInterval(() => {
      setClock((prev) => ({
        stepKey,
        seconds: prev.stepKey === stepKey ? prev.seconds + 1 : 1,
      }));
    }, 1000);
    return () => clearInterval(id);
  }, [budget, stepKey]);

  const remainingSeconds = budget === null ? null : budget - elapsed;

  // The channel is opened once and kept, rather than rebuilt whenever the position changes. It
  // has to outlive a single step now that it answers questions, and the old effect tore it down
  // and rebuilt it every second on any step carrying a budget.
  const channelRef = useRef<BroadcastChannel | null>(null);
  const positionRef = useRef<PresenterMessage>({ moduleId, stepIndex: index, remainingSeconds });

  useEffect(() => {
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(PRESENTER_CHANNEL);
    } catch {
      // No BroadcastChannel: the lecture shell still works, the presenter window simply
      // never updates. A shell that threw here would take the lecture down with it.
      return;
    }
    channelRef.current = channel;
    channel.onmessage = (event) => {
      // A presenter window has just opened and is asking where the lecture is. Answer with the
      // position as it stands, read through a ref: a closure formed at mount would answer with
      // the step the lecture started on, which is the same silence in a different costume.
      if (isPresenterHello(event.data)) channel.postMessage(positionRef.current);
    };
    return () => {
      channelRef.current = null;
      channel.close();
    };
  }, []);

  useEffect(() => {
    positionRef.current = { moduleId, stepIndex: index, remainingSeconds };
    channelRef.current?.postMessage(positionRef.current);
  }, [index, moduleId, remainingSeconds]);

  return { index, count, remainingSeconds, next, prev, goTo };
}
