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
      return { ...exp, versions: { key: i, adapted: textsOf(exp), original: textsOf(source) } };
    }),
  };
}

/** The version a text shows: a text matching neither imported nor adapted is the user's own */
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

/**
 * The summary or the title in the version chosen. A text the user typed is
 * kept as their own version before another one takes its place.
 */
export function withPersonalVersion(info: PersonalInfo, field: 'summary' | 'title', version: Version): PersonalInfo {
  const versions = info.versions?.[field];
  if (!versions) return info;
  const typed = versionOf(info[field], versions) === 'edited' ? info[field] ?? '' : versions.edited;
  const kept = typed === undefined ? versions : { ...versions, edited: typed };
  const text = version === 'edited' ? kept.edited ?? info[field] ?? '' : kept[version];
  return { ...info, [field]: text, versions: { ...info.versions, [field]: kept } };
}

/** An experience's intro and bullets in the version chosen, what the user typed kept the same way */
export function withExperienceVersion(exp: Experience, version: Version): Experience {
  const versions = exp.versions;
  if (!versions) return exp;
  const typed = experienceVersionOf(exp) === 'edited' ? textsOf(exp) : versions.edited;
  const kept = typed === undefined ? versions : { ...versions, edited: typed };
  const texts = version === 'edited' ? kept.edited ?? textsOf(exp) : kept[version];
  return { ...exp, ...texts, versions: kept };
}

/** A block of the CV that has versions */
export type VersionedBlock = { field: 'summary' | 'title' } | { experience: number };

/**
 * The CV with `block` in the version chosen, in every language it holds
 * (arbitrage of 2026-10-07): the cached language shows the same choice when
 * the user switches to it, a role found there by its versions' key. What the
 * user typed is a text of one language: a typed version is picked in that
 * language only, and a block the other language shows typed stays as it is.
 */
export function withVersionChosen(cv: CVData, block: VersionedBlock, version: Version): CVData {
  const key = 'experience' in block ? cv.experience[block.experience]?.versions?.key : undefined;
  const chosen = 'field' in block
    ? { ...cv, personal_info: withPersonalVersion(cv.personal_info, block.field, version) }
    : { ...cv, experience: cv.experience.map((exp, i) => (i === block.experience ? withExperienceVersion(exp, version) : exp)) };
  if (version === 'edited' || !cv._translations) return chosen;
  // The other language: the same block, unless it shows a text the user typed there
  const follow = <T extends { personal_info: PersonalInfo; experience: Experience[] }>(content: T): T => {
    if ('field' in block) {
      const versions = content.personal_info.versions?.[block.field];
      if (!versions || versionOf(content.personal_info[block.field], versions) === 'edited') return content;
      return { ...content, personal_info: withPersonalVersion(content.personal_info, block.field, version) };
    }
    if (key === undefined) return content;
    return {
      ...content,
      experience: content.experience.map(exp => (exp.versions?.key === key && experienceVersionOf(exp) !== 'edited' ? withExperienceVersion(exp, version) : exp)),
    };
  };
  const cache = Object.fromEntries(Object.entries(cv._translations).map(([lang, content]) => [lang, content && follow(content)]));
  return { ...chosen, _translations: cache };
}
