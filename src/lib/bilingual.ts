import { omitUserOwnedFields, type CVData } from '../shared/types';
import { detectCVLanguage, getCVLanguage, type SupportedLanguage } from './language-detection';
import { withVersions } from '@/src/features/editor/lib/cv-versions';

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
 * With `source`, the imported CV the generation started from, each language
 * also carries the user's own texts beside the adapted ones (`withVersions`):
 * the source in its own language, and once translated into the other, both
 * calls part of the one generation. The editor never calls the AI for them.
 *
 * If a translation fails, what it would have given is left out: the CV is
 * returned without that language (the lazy toggle still works) or without its
 * versions, so a translate outage never blocks the main generation.
 */
export async function attachBilingualCache(
  cv: CVData,
  translate: TranslateFn,
  accessCode?: string,
  source?: CVData,
): Promise<CVData> {
  const langA = getCVLanguage(cv);
  const langB: SupportedLanguage = langA === 'en' ? 'fr' : 'en';
  const sourceLang = source ? detectCVLanguage(source) : langA;
  const otherLang: SupportedLanguage = sourceLang === 'en' ? 'fr' : 'en';
  const [translated, sourceTranslated] = await Promise.all([
    translate({ cvData: cv, targetLanguage: langB, accessCode })
      .catch((e) => { console.warn('[attachBilingualCache] background translation failed, lazy toggle will handle it:', e); return null; }),
    source
      ? translate({ cvData: source, targetLanguage: otherLang, accessCode })
        .catch((e) => { console.warn('[attachBilingualCache] the imported CV was not translated, no imported version in that language:', e); return null; })
      : null,
  ]);
  const originals: Partial<Record<SupportedLanguage, CVData | null>> = source ? { [sourceLang]: source, [otherLang]: sourceTranslated } : {};
  const paired = (version: CVData, lang: SupportedLanguage) => {
    const original = originals[lang];
    return original ? withVersions(version, original) : version;
  };
  const cvA = paired(cv, langA);
  if (!translated) return cvA;
  return {
    ...cvA,
    _translations: {
      ...cv._translations,
      [langA]: contentSnapshot(cvA),
      [langB]: contentSnapshot(paired(translated, langB)),
    },
  };
}
