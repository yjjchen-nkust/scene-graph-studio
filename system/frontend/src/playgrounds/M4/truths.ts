import type { Locale } from '../../i18n/useLocale';

/**
 * The truths note E3, E4 and E7 each print beside their `E*.truths` readout: the matched ground
 * truths named `g{id}`, joined by `、` in 繁體中文 and `, ` in English, or `playground.m4.none`
 * when the top k names none at all, filled into `playground.m4.truths_note`.
 *
 * Pure, so the three playgrounds' own tests hold their readout to this rather than to three
 * copies of the same three lines: `matchedTruths` decides which ids are matched, this decides
 * only how they are written.
 */
export function truthsNote(ids: number[], locale: Locale, t: (key: string) => string): string {
  const separator = locale === 'zh-TW' ? '、' : ', ';
  const idsText = ids.length > 0 ? ids.map((id) => `g${id}`).join(separator) : t('playground.m4.none');
  return t('playground.m4.truths_note').replace('{ids}', idsText);
}
