import { franc } from 'franc-min';
import type { CVData } from '../shared/types';

export type SupportedLanguage = 'fr' | 'en';

const ISO_TO_LANG: Record<string, SupportedLanguage> = {
  fra: 'fr',
  eng: 'en',
};

const MIN_TEXT_LENGTH = 20;

/**
 * Extracts concatenated text from CV data for language detection.
 * Combines: title, summary, experience positions/intros/descriptions, skill items.
 */
export function extractCVText(cvData: CVData): string {
  const parts: string[] = [];

  if (cvData.personal_info.title) parts.push(cvData.personal_info.title);
  if (cvData.personal_info.summary) parts.push(cvData.personal_info.summary);

  for (const exp of cvData.experience) {
    if (exp.position) parts.push(exp.position);
    if (exp.intro) parts.push(exp.intro);
    for (const desc of exp.description) {
      parts.push(desc);
    }
  }

  for (const cat of cvData.skills) {
    parts.push(...cat.items);
  }

  return parts.join(' ');
}

/**
 * Detects the language of a CV using franc-min.
 * Returns 'fr' for short/empty text or when detection is undetermined.
 */
export function detectCVLanguage(cvData: CVData): SupportedLanguage {
  const text = extractCVText(cvData);

  if (text.length < MIN_TEXT_LENGTH) {
    return 'fr';
  }

  const detected = franc(text, { only: ['fra', 'eng'] });
  return ISO_TO_LANG[detected] ?? 'fr';
}

/**
 * Returns the effective language for downstream systems.
 * Priority: languageOverride > detectedLanguage > 'fr' (default).
 */
export function getCVLanguage(cvData: CVData): SupportedLanguage {
  return cvData.languageOverride ?? cvData.detectedLanguage ?? 'fr';
}
