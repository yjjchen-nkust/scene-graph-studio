import { useSyncExternalStore } from 'react';
import { read, write } from '../store/persist';
import en from './en.json';
import zh from './zh-TW.json';

export type Locale = 'zh-TW' | 'en';

const TABLES: Record<Locale, Record<string, string>> = { 'zh-TW': zh, en };
const listeners = new Set<() => void>();

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'zh-TW';
}

/**
 * The stored preference, through the one module that touches `localStorage`.
 *
 * This slot used to be written as a bare string while every other slot was JSON, which meant the
 * same key had two encodings depending on which module wrote it. Nothing had yet written it
 * through `persist`, so the collision was invisible until a Playwright run seeded the preference
 * in the JSON form and the application read it back as the default. One encoding now. A
 * preference stored in the old form reads as unparseable and falls back, which costs a student
 * one click of the toggle, once.
 */
let current: Locale = read('lang', isLocale, 'zh-TW');

export function setLocale(next: Locale): void {
  current = next;
  write('lang', next);
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn());
}

/**
 * There is no fallback locale. A missing key renders as its own name in development and
 * throws in a production build, so `npm run lint:i18n` catching it is the only way it ships.
 * NFR-6: a silent fallback to English lets a half-translated build look finished.
 */
export function useLocale() {
  const locale = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => current,
    () => 'zh-TW' as Locale,
  );

  const t = (key: string): string => {
    const value = TABLES[locale][key];
    if (value === undefined) {
      if (import.meta.env.DEV) return `⟦${key}⟧`;
      throw new Error(`missing i18n key: ${key}`);
    }
    return value;
  };

  return { locale, t, setLocale };
}
