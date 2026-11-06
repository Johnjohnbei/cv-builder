import type { CVData, SkillCategory } from '@/src/shared/types';
import { stripAccents } from '@/src/shared/lib/text';

// ─── What the code corrects by itself (arbitrage of 2026-11-06) ───
// A defect the code can both detect and fix WITHOUT inventing anything is
// fixed on load, silently, and named in a notification. Everything that needs
// a human choice is edited in the preview instead (in-place-edit.ts).
//
// Dates are deliberately absent: formatDateShort already prints every date it
// can read in one format, and a bare year has no month to add without making
// one up.

/**
 * An abbreviation a job-title parser misses, and the word it stands for. The
 * list mirrors the `titles` check of computeATSReport, which flags exactly
 * these: what the code writes out is what the check then stops reporting.
 *
 * `dot` marks an abbreviation that only counts with its full stop: "Dev Ops"
 * is a job, "Dév. Ops" is an abbreviation of one.
 */
const ABBREVIATIONS: Record<string, { fr: string; en: string; dot?: true }> = {
  sr: { fr: 'Senior', en: 'Senior' },
  jr: { fr: 'Junior', en: 'Junior' },
  mgr: { fr: 'Manager', en: 'Manager' },
  dir: { fr: 'Directeur', en: 'Director' },
  asst: { fr: 'Assistant', en: 'Assistant' },
  resp: { fr: 'Responsable', en: 'Head of' },
  dev: { fr: 'Développeur', en: 'Developer', dot: true },
};

/**
 * One job title with its abbreviations written out.
 *
 * Token by token, and only on a token that IS the abbreviation: "Direction"
 * keeps its place, "Dir." becomes "Directeur". The capital of the expansion is
 * the one written here, so "sr designer" reads "Senior designer": the rest of
 * the title is the user's writing and is never touched.
 */
export function expandAbbreviations(title: string, language: 'fr' | 'en'): string {
  return title
    .split(/(\s+)/)
    .map(token => {
      const plain = stripAccents(token).toLowerCase();
      const expansion = ABBREVIATIONS[plain.replace(/\.$/, '')];
      if (!expansion || (expansion.dot && !plain.endsWith('.'))) return token;
      return expansion[language];
    })
    .join('');
}

/**
 * Categories sharing a key merged into the first one, duplicate items dropped.
 *
 * The truth guard renames a category the model invented to `other`
 * (truthGuard.ts): two inventions in one generation printed two "Autres"
 * blocks, each with its own title, for one list of skills.
 */
export function mergeSkillCategories(skills: SkillCategory[]): SkillCategory[] {
  const merged: SkillCategory[] = [];
  for (const cat of skills) {
    const seen = merged.find(c => c.category === cat.category);
    if (!seen) {
      merged.push({ ...cat, items: [...new Set(cat.items)] });
      continue;
    }
    seen.items = [...new Set([...seen.items, ...cat.items])];
  }
  return merged;
}

/**
 * The CV with every form defect the code can fix on its own corrected, and
 * what it changed, in French, to be shown to the user. An unchanged CV returns
 * the very same object.
 */
export function autoCorrect(cv: CVData, language: 'fr' | 'en'): { cv: CVData; corrections: string[] } {
  const corrections: string[] = [];

  const title = cv.personal_info.title ? expandAbbreviations(cv.personal_info.title, language) : cv.personal_info.title;
  const experience = (cv.experience ?? []).map(exp => {
    const position = expandAbbreviations(exp.position ?? '', language);
    return position === exp.position ? exp : { ...exp, position };
  });
  const expanded = (title !== cv.personal_info.title ? 1 : 0)
    + experience.filter((exp, i) => exp !== cv.experience[i]).length;
  if (expanded > 0) {
    corrections.push(expanded === 1
      ? '1 intitulé abrégé écrit en entier'
      : `${expanded} intitulés abrégés écrits en entier`);
  }

  const countItems = (list: SkillCategory[]) => list.reduce((total, cat) => total + cat.items.length, 0);
  const skills = mergeSkillCategories(cv.skills ?? []);
  const fused = (cv.skills?.length ?? 0) - skills.length;
  if (fused > 0) {
    corrections.push(fused === 1
      ? '1 catégorie de compétences en double fusionnée'
      : `${fused} catégories de compétences en double fusionnées`);
  }
  const dropped = countItems(cv.skills ?? []) - countItems(skills);
  if (dropped > 0) {
    corrections.push(dropped === 1 ? '1 compétence en double retirée' : `${dropped} compétences en double retirées`);
  }

  if (corrections.length === 0) return { cv, corrections };
  return {
    cv: { ...cv, personal_info: { ...cv.personal_info, title }, experience, skills },
    corrections,
  };
}
