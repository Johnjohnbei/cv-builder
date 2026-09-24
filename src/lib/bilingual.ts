import { omitUserOwnedFields, type CVData } from '../shared/types';
import { getCVLanguage, type SupportedLanguage } from './language-detection';

/**
 * Convex action signature for translateCV, kept structural so this helper has
 * no dependency on the generated API surface.
 */
type TranslateFn = (args: {
  cvData: CVData;
  targetLanguage: SupportedLanguage;
  accessCode?: string;
}) => Promise<CVData>;

/**
 * Snapshot of the translatable content, cached per language. User-owned fields
 * are excluded: they are identical in both languages, the photo's base64
 * payload would otherwise be stored once more per cached language (Convex doc
 * cap ~1 MiB), and a cached portfolio link would bring back one the user changed.
 */
export const contentSnapshot = (cv: CVData) => ({
  personal_info: omitUserOwnedFields(cv.personal_info),
  experience: cv.experience,
  education: cv.education,
  skills: cv.skills,
  languages: cv.languages,
});

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
        [langA]: contentSnapshot(cv),
        [langB]: contentSnapshot(translated),
      },
    };
  } catch (e) {
    console.warn('[attachBilingualCache] background translation failed, lazy toggle will handle it:', e);
    return cv;
  }
}
