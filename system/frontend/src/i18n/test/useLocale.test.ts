import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  localStorage.clear();
  document.documentElement.lang = 'zh-TW';
});

describe('the document language', () => {
  it('is the stored locale from the moment the module loads, not only after a toggle', async () => {
    // `index.html` ships `lang="zh-TW"`, and only `setLocale` wrote the attribute, so a reader who
    // had chosen English read an English page that told the browser, the screen reader and the
    // hyphenator it was Chinese until they pressed the toggle again.
    localStorage.setItem('sgs:v1:lang', '"en"');
    document.documentElement.lang = 'zh-TW';
    vi.resetModules();
    await import('../useLocale');
    expect(document.documentElement.lang).toBe('en');
  });

  it('follows a locale written by another window of this origin', async () => {
    vi.resetModules();
    const { setLocale } = await import('../useLocale');
    setLocale('en');
    // The browser fires `storage` in every window of the origin except the one that wrote.
    localStorage.setItem('sgs:v1:lang', '"zh-TW"');
    window.dispatchEvent(new StorageEvent('storage', { key: 'sgs:v1:lang', newValue: '"zh-TW"' }));
    expect(document.documentElement.lang).toBe('zh-TW');
  });
});
