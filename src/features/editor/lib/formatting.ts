// --- Date formatting ---

/**
 * Map of any month input (long FR, long EN, short EN, short FR) to its
 * numeric index (1-12). Source of truth for parsing — keeps it locale-agnostic.
 */
const MONTH_TO_INDEX: Record<string, number> = {
  // FR long
  'janvier': 1, 'février': 2, 'mars': 3, 'avril': 4, 'mai': 5, 'juin': 6,
  'juillet': 7, 'août': 8, 'septembre': 9, 'octobre': 10, 'novembre': 11, 'décembre': 12,
  // FR short with optional period
  'janv': 1, 'fév': 2, 'avr': 4, 'juil': 7, 'sept': 9, 'oct': 10, 'nov': 11, 'déc': 12,
  // EN long
  'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
  'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
  // EN short
  'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'jun': 6, 'jul': 7, 'aug': 8,
  'sep': 9, 'dec': 12,
};

const MONTHS_SHORT_FR: ReadonlyArray<string> = [
  'Janv.', 'Fév.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.',
];

const MONTHS_SHORT_EN: ReadonlyArray<string> = [
  'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.',
];

export type DateLanguage = 'fr' | 'en';

/** Returns the localized abbreviation for "current job" — "Présent" or "Present". */
export function getCurrentLabel(language: DateLanguage): string {
  return language === 'en' ? 'Present' : 'Présent';
}

/**
 * Shorten and translate a date string for CV display.
 *
 * Input is parsed flexibly (FR or EN, long or short, numeric or ISO formats).
 * Output is always in the target language with the short month abbreviation.
 *
 * Programmatic translation — no LLM. The translateCV flow keeps dates as-is
 * in the JSON (cf prompt rule #7) so this renderer is the single source of
 * truth for what the user sees.
 *
 * Examples (language = 'en'):
 * - "Septembre 2021" → "Sep. 2021"
 * - "2021-05" → "May 2021"
 * - "01/2021" → "Jan. 2021"
 * - "Mai 2026" → "May 2026"
 *
 * Examples (language = 'fr', the default for backward compat):
 * - "September 2021" → "Sept. 2021"
 * - "2021-05" → "Mai 2021"
 */
export function formatDateShort(date?: string, language: DateLanguage = 'fr'): string {
  if (!date) return '';
  const d = date.trim();
  const months = language === 'en' ? MONTHS_SHORT_EN : MONTHS_SHORT_FR;

  // Pure year — nothing to localize
  if (/^\d{4}$/.test(d)) return d;

  // "Month Year" or "Month. Year" — locale-agnostic parse
  const monthYearMatch = d.match(/^([A-Za-zÀ-ÿ]+)\.?\s+(\d{4})$/);
  if (monthYearMatch) {
    const monthKey = monthYearMatch[1].toLowerCase();
    const idx = MONTH_TO_INDEX[monthKey];
    if (idx) return `${months[idx - 1]} ${monthYearMatch[2]}`;
  }

  // "MM/YYYY" or "MM-YYYY"
  const slashMatch = d.match(/^(\d{1,2})[/\-](\d{4})$/);
  if (slashMatch) {
    const monthNum = parseInt(slashMatch[1], 10);
    return `${months[monthNum - 1] || ''} ${slashMatch[2]}`;
  }

  // "YYYY-MM" (ISO partial)
  const isoMatch = d.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMatch) {
    const monthNum = parseInt(isoMatch[2], 10);
    return `${months[monthNum - 1] || ''} ${isoMatch[1]}`;
  }

  return d; // return as-is if no pattern matches
}

// --- Language proficiency normalization ---

const PROFICIENCY_MAP: Record<string, string> = {
  'native or bilingual': 'Natif / Bilingue',
  'native or bilingual proficiency': 'Natif / Bilingue',
  'full professional': 'Courant (C1)',
  'full professional proficiency': 'Courant (C1)',
  'professional working': 'Professionnel (B2)',
  'professional working proficiency': 'Professionnel (B2)',
  'limited working': 'Intermédiaire (B1)',
  'limited working proficiency': 'Intermédiaire (B1)',
  'elementary': 'Débutant (A2)',
  'elementary proficiency': 'Débutant (A2)',
};

/** Normalize language proficiency to French labels */
export function normalizeProficiency(proficiency: string): string {
  return PROFICIENCY_MAP[proficiency.toLowerCase().trim()] || proficiency;
}
