import type { CVData, Experience, ExperienceText, PersonalInfo, TextVersions } from '@/src/shared/types';

// ─── Two versions of each rewritten text (arbitrage of 2026-10-07) ───
// A generation leaves the text adapted to the offer and the user's own text
// from the imported CV, in the same language. The user picks one in the
// editor: no AI call, ever, after the generation.

/** Which version a text shows: one of the two, or neither once the user typed in it */
export type Version = 'adapted' | 'original' | 'edited';

const textsOf = (exp: Pick<Experience, 'intro' | 'description'>): ExperienceText => ({ intro: exp.intro, description: exp.description });

const sameTexts = (a: ExperienceText, b: ExperienceText) =>
  (a.intro ?? '').trim() === (b.intro ?? '').trim()
  && a.description.length === b.description.length
  && a.description.every((bullet, i) => bullet.trim() === b.description[i].trim());

/**
 * Both versions of a text, when the imported CV has one and the generation
 * changed it. An adapted text left empty (a summary hidden because it said too
 * little) still pairs: the user can bring their own back.
 */
const paired = (adapted: string | undefined, original: string | undefined): TextVersions | undefined =>
  original?.trim() && (adapted ?? '').trim() !== original.trim() ? { adapted: adapted ?? '', original } : undefined;

/**
 * The generated CV with the imported CV's texts beside its own, paired by
 * place: the tailoring keeps every experience, in order (tailor.ts rejects an
 * answer that drops one). `original` is the imported CV in the generated CV's
 * language.
 */
export function withVersions(cv: CVData, original: CVData): CVData {
  const summary = paired(cv.personal_info.summary, original.personal_info.summary);
  const title = paired(cv.personal_info.title, original.personal_info.title);
  return {
    ...cv,
    personal_info: { ...cv.personal_info, ...(summary || title ? { versions: { summary, title } } : {}) },
    experience: cv.experience.map((exp, i) => {
      const source = original.experience[i];
      if (!source || sameTexts(textsOf(exp), textsOf(source))) return exp;
      return { ...exp, versions: { adapted: textsOf(exp), original: textsOf(source) } };
    }),
  };
}

/** The version a text shows */
export function versionOf(current: string | undefined, versions: TextVersions): Version {
  const text = (current ?? '').trim();
  if (text === versions.adapted.trim()) return 'adapted';
  return text === versions.original.trim() ? 'original' : 'edited';
}

/** The version an experience shows: its intro and its bullets together */
export function experienceVersionOf(exp: Experience): Version | null {
  if (!exp.versions) return null;
  if (sameTexts(textsOf(exp), exp.versions.adapted)) return 'adapted';
  return sameTexts(textsOf(exp), exp.versions.original) ? 'original' : 'edited';
}

/** The summary or the title in the version chosen */
export function withPersonalVersion(info: PersonalInfo, field: 'summary' | 'title', version: Exclude<Version, 'edited'>): PersonalInfo {
  const versions = info.versions?.[field];
  return versions ? { ...info, [field]: versions[version] } : info;
}

/** An experience's intro and bullets in the version chosen */
export function withExperienceVersion(exp: Experience, version: Exclude<Version, 'edited'>): Experience {
  return exp.versions ? { ...exp, ...exp.versions[version] } : exp;
}
