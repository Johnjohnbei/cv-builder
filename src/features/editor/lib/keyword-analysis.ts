// ─── ATS score: the offer's requirements against what the CV prints ───
// Pure, and imported by the Convex functions too: relative imports only (the
// Convex bundler does not resolve the "@/" alias), types imported as types.

import type {
  ATSReport, CVData, CVSection, DesignSettings, Experience, JobRequirement, ReadabilityCheck, RequirementCoverage,
} from '../../../shared/types';
import { matchPhrase, normalizeForMatch, prepareText, stripInlineMarkdown, type PreparedText } from '../../../shared/lib/text';
import { getLocalizedStage } from '../../../shared/constants/company-meta';
import { getCVLanguage, type SupportedLanguage } from '../../../lib/language-detection';
import { getActionBullets, getIntro, getVisibleSkills, isHidden, isSkillHidden, shouldShowKPI } from './display-modes';
import { getSkillCategoryTitle } from './ats-rules';
import type { SkillCategoryKey } from './skill-dictionary';
import { localizeLanguageName } from './formatting';
import { hasReadableDates, yearsOfExperience } from './experience-years';

// ─── What an ATS reads ───

/**
 * 'rendered': what the templates print, display modes applied, so what the PDF
 * carries. 'content': every experience, bullet, KPI and skill, for a CV no one
 * has fitted to its pages yet (the output of an AI generation).
 */
export type CVTextView = 'rendered' | 'content';

/** The Design toggle (includedSections) each part of the CV belongs to; the header is always printed */
const SECTION_TOGGLE: Record<Exclude<CVSection, 'title'>, string> = {
  summary: 'summary', experience: 'experience', skills: 'skills', education: 'education', languages: 'languages',
};

type IncludedSections = Pick<DesignSettings, 'includedSections'>;

const isShown = (section: CVSection, design?: IncludedSections) =>
  section === 'title' || !design?.includedSections || design.includedSections.includes(SECTION_TOGGLE[section]);

/**
 * Text of one experience as the templates print it: position, company, its
 * company tags (CompanyTags), intro, bullets and KPI, with the markdown the
 * templates render in the last three. The ATS score and the per-experience
 * relevance badge read the same text.
 */
export function experienceText(exp: Experience, view: CVTextView, language: SupportedLanguage = 'fr'): string[] {
  const tags = [getLocalizedStage(exp.companyStage, language), exp.companyBusinessModel];
  const md = (text: string | null | undefined) => stripInlineMarkdown(text);
  const parts = view === 'content'
    ? [exp.position, exp.company, ...tags, md(exp.intro), ...exp.description.map(md), md(exp.kpi)]
    : isHidden(exp)
      ? []
      : [exp.position, exp.company, ...tags, md(getIntro(exp)), ...getActionBullets(exp).map(md), shouldShowKPI(exp) ? md(exp.kpi) : undefined];
  return parts.filter((text): text is string => Boolean(text?.trim()));
}

/** The experiences whose dates and positions the CV prints */
function experiencesInView(cv: CVData, view: CVTextView, design?: IncludedSections): Experience[] {
  if (!isShown('experience', design)) return [];
  return view === 'content' ? cv.experience : cv.experience.filter(exp => !isHidden(exp));
}

/**
 * The text of each part of the CV. Single owner of "what the CV says": the
 * score reads it, and so does the PDF text check (pdfValidation).
 */
export function cvSections(cv: CVData, view: CVTextView, design?: IncludedSections): Record<CVSection, string[]> {
  const language = getCVLanguage(cv);
  const categoryTitle = (category: string) => getSkillCategoryTitle(category as SkillCategoryKey, language);
  const raw: Record<CVSection, (string | undefined)[]> = {
    title: [cv.personal_info.title],
    // The templates render markdown in the summary, and print the other sections as typed
    summary: [stripInlineMarkdown(cv.personal_info.summary)],
    experience: cv.experience.flatMap(exp => experienceText(exp, view, language)),
    skills: cv.skills.flatMap(cat => {
      const items = view === 'content' ? cat.items : isSkillHidden(cat) ? [] : getVisibleSkills(cat);
      // A category with no item is not printed, its title neither
      return items.length > 0 ? [categoryTitle(cat.category), ...items] : [];
    }),
    education: cv.education.flatMap(edu => [edu.degree, edu.field, edu.school]),
    // Printed in the CV's language, as the templates print them
    languages: cv.languages.map(lang => localizeLanguageName(lang.name, language)),
  };
  const sections = {} as Record<CVSection, string[]>;
  for (const section of Object.keys(raw) as CVSection[]) {
    sections[section] = isShown(section, design)
      ? raw[section].filter((text): text is string => Boolean(text?.trim()))
      : [];
  }
  return sections;
}

// ─── The score ───

/** A title filters candidates first; a soft skill is never what decides */
export function weightOf(r: JobRequirement): number {
  if (r.kind === 'soft_skill') return 1;
  return r.kind === 'title' || r.importance === 'required' ? 3 : 1;
}

/**
 * Whether rewriting the CV can cover this requirement: a degree, a language or
 * a number of years is a fact of the candidate's past, never a wording.
 */
export function isWritable(r: JobRequirement): boolean {
  return r.kind !== 'education' && r.kind !== 'language' && r.kind !== 'experience_years';
}

/**
 * Whether a proof from the user can put this requirement in the CV: a rewrite
 * writes a skill or a bullet, and neither is a job title. The title of the CV
 * and the positions held are the user's own words, edited in the Contenu tab.
 */
export function isProvable(r: JobRequirement): boolean {
  return isWritable(r) && r.kind !== 'title';
}

/** Whether these fields, as the CV prints them, write the requirement */
export const writesRequirement = (fields: PreparedText[], r: JobRequirement): boolean =>
  [r.label, ...r.variants].some(term => fields.some(field => matchPhrase(term, field)));

/** The requirements of the offer the CV does not write */
export const gapsOf = (report: ATSReport): RequirementCoverage[] => report.requirements.filter(c => !c.found);

/** "Sr.", "Mgr", "Dév.", "Resp.": a parser matching job titles misses them (read normalized, accents gone) */
const ABBREVIATED_TITLE = /\b(sr|jr|mgr|dir|asst|resp)\b\.?|\bdev\./;

export interface ATSReportOptions {
  view?: CVTextView;
  design?: IncludedSections;
  now?: Date;
}

/**
 * Weighted share of the offer's requirements present in the CV, as an ATS
 * searches them, plus the checks a parser needs. No correction factor: the
 * score is recounted by hand from the weights and points it returns.
 */
export function computeATSReport(cv: CVData, requirements: JobRequirement[], options: ATSReportOptions = {}): ATSReport {
  const { view = 'rendered', design, now } = options;
  const sections = cvSections(cv, view, design);
  const experiences = experiencesInView(cv, view, design);
  const prepared = Object.fromEntries(
    (Object.keys(sections) as CVSection[]).map(section => [section, prepareText(sections[section].join(' | '))]),
  ) as Record<CVSection, PreparedText>;
  const positions = prepareText(experiences.map(exp => exp.position).join(' | '));
  const years = yearsOfExperience(experiences, now);

  const coverage = requirements.map((requirement): RequirementCoverage => {
    const has = (text: PreparedText) => writesRequirement([text], requirement);
    const where = (candidates: CVSection[]) => candidates.filter(section => has(prepared[section]));
    let found: CVSection[];
    switch (requirement.kind) {
      case 'experience_years':
        found = years >= (requirement.minYears ?? Infinity) ? ['experience'] : [];
        break;
      case 'title':
        found = [...where(['title']), ...(has(positions) ? ['experience' as const] : [])];
        break;
      case 'education':
        found = where(['education']);
        break;
      case 'language':
        found = where(['languages']);
        break;
      default:
        found = where(['title', 'summary', 'experience', 'skills', 'education', 'languages']);
    }
    return {
      requirement, found: found.length > 0, sections: found, weight: weightOf(requirement),
      ...(requirement.kind === 'experience_years' && { years }),
    };
  });

  const total = coverage.reduce((sum, c) => sum + c.weight, 0);
  const covered = coverage.reduce((sum, c) => sum + (c.found ? c.weight : 0), 0);

  const { email = '', phone = '', location = '', title = '' } = cv.personal_info;
  const checks: ReadabilityCheck[] = [
    { id: 'email', passed: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) },
    { id: 'phone', passed: phone.replace(/\D/g, '').length >= 7 },
    { id: 'location', passed: location.trim().length > 0 },
    {
      id: 'titles',
      passed: ![title, ...experiences.map(exp => exp.position)].some(t => ABBREVIATED_TITLE.test(normalizeForMatch(t ?? ''))),
    },
    { id: 'dates', passed: experiences.every(hasReadableDates) },
  ];

  return {
    score: total > 0 ? Math.round((100 * covered) / total) : null,
    requirements: coverage,
    points: { covered, total },
    checks,
  };
}
