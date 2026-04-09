// --- Date formatting ---

const MONTH_MAP_FR: Record<string, string> = {
  'janvier': 'Janv.', 'février': 'Fév.', 'mars': 'Mars', 'avril': 'Avr.',
  'mai': 'Mai', 'juin': 'Juin', 'juillet': 'Juil.', 'août': 'Août',
  'septembre': 'Sept.', 'octobre': 'Oct.', 'novembre': 'Nov.', 'décembre': 'Déc.',
  'january': 'Jan.', 'february': 'Feb.', 'march': 'Mar.', 'april': 'Apr.',
  'may': 'May', 'june': 'Jun.', 'july': 'Jul.', 'august': 'Aug.',
  'september': 'Sep.', 'october': 'Oct.', 'november': 'Nov.', 'december': 'Dec.',
  'jan': 'Jan.', 'feb': 'Fév.', 'mar': 'Mars', 'apr': 'Avr.',
  'jun': 'Juin', 'jul': 'Juil.', 'aug': 'Août', 'sep': 'Sept.', 'oct': 'Oct.', 'nov': 'Nov.', 'dec': 'Déc.',
};

/**
 * Shorten a date string for CV display.
 * "Septembre 2021" → "Sept. 2021"
 * "2021" → "2021"
 * "01/2021" → "Jan. 2021"
 * "2021-09" → "Sept. 2021"
 */
export function formatDateShort(date?: string): string {
  if (!date) return '';
  const d = date.trim();

  // Pure year
  if (/^\d{4}$/.test(d)) return d;

  // "Month Year" or "Month. Year"
  for (const [long, short] of Object.entries(MONTH_MAP_FR)) {
    const re = new RegExp(`^${long}\\.?\\s*(\\d{4})$`, 'i');
    const m = d.match(re);
    if (m) return `${short} ${m[1]}`;
  }

  // "MM/YYYY" or "MM-YYYY"
  const slashMatch = d.match(/^(\d{1,2})[/\-](\d{4})$/);
  if (slashMatch) {
    const monthNum = parseInt(slashMatch[1], 10);
    const monthNames = ['Jan.', 'Fév.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    return `${monthNames[monthNum - 1] || ''} ${slashMatch[2]}`;
  }

  // "YYYY-MM"
  const isoMatch = d.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMatch) {
    const monthNum = parseInt(isoMatch[2], 10);
    const monthNames = ['Jan.', 'Fév.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    return `${monthNames[monthNum - 1] || ''} ${isoMatch[1]}`;
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
