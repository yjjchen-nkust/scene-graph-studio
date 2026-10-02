import { useRef, useState, type ChangeEvent, type CompositionEvent } from 'react';

/**
 * A field over a value that lives in the URL, typed into without the URL in the way.
 *
 * The router applies a navigation inside `startTransition` (react-router 7.18, `MemoryRouter` and
 * `RouterProvider` alike), so a field whose `value` is read from the query string still holds the
 * old text when React finishes the keystroke. React restores that old text, which puts the caret
 * at the end, and the transition writes the new text a moment later, at the end again: a key
 * typed in the middle of a word lands there and the next one lands at the end. An input method
 * fares worse, because the restore rewrites the field under the composition.
 *
 * So the field shows its own raw text from the first keystroke until it loses focus, as L5's TEC
 * editor does (D120), and the URL is written beside it rather than read back into it. Blur hands
 * the field back to the URL. While an input method is composing nothing is written: half-composed
 * syllables are not a query, and the composition's end writes what it produced.
 */
export function useFieldDraft(stored: string, commit: (raw: string) => void) {
  const [draft, setDraft] = useState<string | null>(null);
  const composing = useRef(false);

  return {
    value: draft ?? stored,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setDraft(raw);
      // `isComposing` as well as the flag, so the field is right whichever of a composition's
      // last `input` and its `compositionend` a browser fires first.
      if (!composing.current && !(e.nativeEvent as InputEvent).isComposing) commit(raw);
    },
    onCompositionStart: () => {
      composing.current = true;
    },
    onCompositionEnd: (e: CompositionEvent<HTMLInputElement>) => {
      composing.current = false;
      const raw = e.currentTarget.value;
      setDraft(raw);
      commit(raw);
    },
    onBlur: () => setDraft(null),
  };
}
