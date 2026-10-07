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

/** Whether a generation left two versions of any block of this CV */
export const hasVersions = (cv: CVData) => Boolean(cv.personal_info.versions || cv.experience.some(exp => exp.versions));

/** The CV in the adapted texts wherever it has them, to translate them with the rest */
export function adaptedTextsOf(cv: CVData): CVData {
  const versions = cv.personal_info.versions;
  return {
    ...cv,
    personal_info: {
      ...cv.personal_info,
      summary: versions?.summary?.adapted ?? cv.personal_info.summary,
      title: versions?.title?.adapted ?? cv.personal_info.title,
    },
    experience: cv.experience.map(exp => (exp.versions ? { ...exp, ...exp.versions.adapted } : exp)),
  };
}

/**
 * The CV in the texts the user typed wherever it keeps one, shown or not, and
 * as it shows everywhere else: translated, it gives every typed version and
 * every block without versions in the new language.
 */
export function typedTextsOf(cv: CVData): CVData {
  const versions = cv.personal_info.versions;
  return {
    ...cv,
    personal_info: {
      ...cv.personal_info,
      summary: versions?.summary && versionOf(cv.personal_info.summary, versions.summary) !== 'edited' && versions.summary.edited !== undefined
        ? versions.summary.edited : cv.personal_info.summary,
      title: versions?.title && versionOf(cv.personal_info.title, versions.title) !== 'edited' && versions.title.edited !== undefined
        ? versions.title.edited : cv.personal_info.title,
    },
    experience: cv.experience.map(exp => (exp.versions?.edited && experienceVersionOf(exp) !== 'edited' ? { ...exp, ...exp.versions.edited } : exp)),
  };
}

/**
 * The versions of `source` rebuilt in another language, block by block, after
 * three translations: `typed` (typedTextsOf: the typed versions and every
 * block without versions), `imported` (importedTextsOf) and `adapted`
 * (adaptedTextsOf). Each block shows the translation of the very version it
 * showed, so the version read back is the one the user picked; only a block
 * that had versions gets them. Without the imported or the adapted
 * translation, the choice is dropped, never the text: `typed` is kept.
 */
export function withTranslatedVersions(source: CVData, typed: CVData, imported: CVData | null, adapted: CVData | null): CVData {
  if (!imported || !adapted) return { ...typed, personal_info: { ...typed.personal_info, versions: undefined }, experience: typed.experience.map(exp => ({ ...exp, versions: undefined })) };
  const personal = (field: 'summary' | 'title') => {
    const before = source.personal_info.versions?.[field];
    if (!before) return { text: typed.personal_info[field], versions: undefined };
    const keepsTyped = versionOf(source.personal_info[field], before) === 'edited' || before.edited !== undefined;
    // A field the translation left out was empty: an empty adapted summary still pairs
    const versions = { adapted: adapted.personal_info[field] ?? '', original: imported.personal_info[field] ?? '', ...(keepsTyped && { edited: typed.personal_info[field] ?? '' }) };
    const shown = versionOf(source.personal_info[field], before);
    return { text: shown === 'edited' ? versions.edited : versions[shown], versions };
  };
  const summary = personal('summary');
  const title = personal('title');
  return {
    ...typed,
    personal_info: {
      ...typed.personal_info,
      summary: summary.text,
      title: title.text,
      versions: summary.versions || title.versions ? { summary: summary.versions, title: title.versions } : undefined,
    },
    experience: typed.experience.map((exp, i) => {
      const before = source.experience[i];
      const shown = before ? experienceVersionOf(before) : null;
      if (!before?.versions || !shown) return { ...exp, versions: undefined };
      const keepsTyped = shown === 'edited' || before.versions.edited !== undefined;
      const versions = { adapted: textsOf(adapted.experience[i]), original: textsOf(imported.experience[i]), ...(keepsTyped && { edited: textsOf(exp) }) };
      return { ...exp, ...(shown === 'edited' ? versions.edited : versions[shown]), versions };
    }),
  };
}

/** The CV in the imported texts wherever it has them, to translate them with the rest */
export function importedTextsOf(cv: CVData): CVData {
  const versions = cv.personal_info.versions;
  return {
    ...cv,
    personal_info: {
      ...cv.personal_info,
      summary: versions?.summary?.original ?? cv.personal_info.summary,
      title: versions?.title?.original ?? cv.personal_info.title,
    },
    experience: cv.experience.map(exp => (exp.versions ? { ...exp, ...exp.versions.original } : exp)),
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
