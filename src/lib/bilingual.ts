import type { CVData } from '../shared/types';
import { getCVLanguage, type SupportedLanguage } from './languageDetection';

/**
 * Convex action signature for translateCV, kept structural so this helper has
 * no dependency on the generated API surface.
 */
type TranslateFn = (args: {
  cvData: CVData;
  targetLanguage: SupportedLanguage;
  accessCode?: string;
}) => Promise<CVData>;

function snapshotOf(cv: CVData) {
  return {
    personal_info: cv.personal_info,
    experience: cv.experience,
    education: cv.education,
    skills: cv.skills,
    languages: cv.languages,
  };
}

/**
 * Given a freshly generated CV in one language, produce the OTHER language too
 * and attach both under `_translations`, so the editor's language toggle is
 * instant from the very first click (no lazy first-toggle LLM call, no mix).
 *
 * The generated CV already IS one language (langA, from getCVLanguage). We
 * translate to langB and cache both snapshots. If the background translation
 * fails, we return the CV unchanged — the lazy toggle still works as a
 * fallback, so a translate outage never blocks the main generation.
 */
export async function attachBilingualCache(
  cv: CVData,
  translate: TranslateFn,
  accessCode?: string,
): Promise<CVData> {
  const langA = getCVLanguage(cv);
  const langB: SupportedLanguage = langA === 'en' ? 'fr' : 'en';
  try {
    const translated = await translate({ cvData: cv, targetLanguage: langB, accessCode });
    return {
      ...cv,
      _translations: {
        ...cv._translations,
        [langA]: snapshotOf(cv),
        [langB]: snapshotOf(translated),
      },
    };
  } catch (e) {
    console.warn('[attachBilingualCache] background translation failed, lazy toggle will handle it:', e);
    return cv;
  }
}
