// Server-side language detection for Convex actions.
// Mirrors src/lib/languageDetection.ts but lives in convex/ so actions can
// import it without crossing the client boundary.

import { franc } from 'franc-min';

export type SupportedLanguage = 'fr' | 'en';

const ISO_TO_LANG: Record<string, SupportedLanguage> = {
  fra: 'fr',
  eng: 'en',
};

const MIN_TEXT_LENGTH = 20;

/** Detect language of arbitrary text. Returns 'fr' as fallback for short/undetermined text. */
export function detectTextLanguage(text: string): SupportedLanguage {
  if (text.length < MIN_TEXT_LENGTH) return 'fr';
  const detected = franc(text, { only: ['fra', 'eng'] });
  return ISO_TO_LANG[detected] ?? 'fr';
}
