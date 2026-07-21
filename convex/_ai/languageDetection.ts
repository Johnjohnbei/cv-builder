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

/**
 * Resolve the language the adapt prompt will use to write the CV.
 * JD wins when present (you adapt to the company's language), then user
 * override, then the CV's last detected language, then FR.
 * Must stay in sync with what the prompt actually instructs the LLM to do —
 * action handlers reuse this to return the right `detectedLanguage` so the UI
 * toggle and section labels match the generated content.
 */
export function resolveAdaptLanguage(
  jobDescription: string | undefined,
  languageOverride: SupportedLanguage | undefined,
  detectedLanguage: SupportedLanguage | undefined,
): SupportedLanguage {
  if (jobDescription && jobDescription.trim().length >= MIN_TEXT_LENGTH) {
    return detectTextLanguage(jobDescription);
  }
  return languageOverride ?? detectedLanguage ?? 'fr';
}
