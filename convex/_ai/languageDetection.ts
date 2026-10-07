// Server-side language detection for Convex actions.
// The detector itself lives in src/lib/languageDetection.ts (stop-word
// scorer, pure TS): Convex bundles imports from outside convex/, so we
// re-export it instead of maintaining a drifting mirror.

export { detectTextLanguage, type SupportedLanguage } from '../../src/lib/language-detection';
import { detectTextLanguage, type SupportedLanguage } from '../../src/lib/language-detection';

const MIN_TEXT_LENGTH = 20;

/**
 * Resolve the language the adapt prompt will use to write the CV.
 * JD wins when present (you adapt to the company's language), then user
 * override, then the CV's last detected language, then FR.
 * The tailoring (tailor.ts) uses it when the user chose no language before the
 * generation, and returns the language it wrote, so the UI toggle and the
 * section labels match the generated content.
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
