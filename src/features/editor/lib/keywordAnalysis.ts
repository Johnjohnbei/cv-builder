// ─── ATS score: the offer's requirements against what the CV prints ───
// Pure, and imported by the Convex functions too: relative imports only (the
// Convex bundler does not resolve the "@/" alias), types imported as types.

import type {
  ATSReport, CVData, CVSection, DesignSettings, Experience, JobRequirement, ReadabilityCheck, RequirementCoverage,
} from '../../../shared/types';
import { matchPhrase, normalizeForMatch, prepareText, stripInlineMarkdown, type PreparedText } from '../../../shared/lib/text';
import { getLocalizedStage } from '../../../shared/constants/companyMeta';
import { getCVLanguage, type SupportedLanguage } from '../../../lib/languageDetection';
import { getActionBullets, getIntro, getVisibleSkills, isHidden, isSkillHidden, shouldShowKPI } from './displayModes';
import { getSkillCategoryTitle } from './atsRules';
import type { SkillCategoryKey } from './skillDictionary';
import { parseMonthYear } from './formatting';

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
 * company tags (CompanyTags), intro, bullets and KPI, inline markdown rendered.
 * The ATS score and the per-experience relevance badge read the same text.
 */
export function experienceText(exp: Experience, view: CVTextView, language: SupportedLanguage = 'fr'): string[] {
  const tags = [getLocalizedStage(exp.companyStage, language), exp.companyBusinessModel];
  const parts = view === 'content'
    ? [exp.position, exp.company, ...tags, exp.intro, ...exp.description, exp.kpi]
    : isHidden(exp)
      ? []
      : [exp.position, exp.company, ...tags, getIntro(exp) ?? undefined, ...getActionBullets(exp), shouldShowKPI(exp) ? exp.kpi : undefined];
  return parts.map(stripInlineMarkdown).filter(text => text.trim());
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
    summary: [cv.personal_info.summary],
    experience: cv.experience.flatMap(exp => experienceText(exp, view, language)),
    skills: cv.skills.flatMap(cat => {
      const items = view === 'content' ? cat.items : isSkillHidden(cat) ? [] : getVisibleSkills(cat);
      // A category with no item is not printed, its title neither
      return items.length > 0 ? [categoryTitle(cat.category), ...items] : [];
    }),
    education: cv.education.flatMap(edu => [edu.degree, edu.field, edu.school]),
    languages: cv.languages.map(lang => lang.name),
  };
  const sections = {} as Record<CVSection, string[]>;
  for (const section of Object.keys(raw) as CVSection[]) {
    sections[section] = isShown(section, design)
      ? raw[section].map(stripInlineMarkdown).filter(text => text.trim())
      : [];
  }
  return sections;
}

// ─── Years of experience ───

/**
 * A month count. A bare year stands for its middle, July for a start and June
 * for an end: "2019 - 2021" may be a few months or three years, and counting
 * the whole years claimed requirements the candidate may not meet.
 */
function monthIndex(date: string | undefined, side: 'start' | 'end'): number | null {
  const parsed = parseMonthYear(date);
  if (!parsed) return null;
  return parsed.year * 12 + (parsed.month ?? (side === 'start' ? 7 : 6)) - 1;
}

/** Whether the dates of a role can be read, so its years are counted */
const hasReadableDates = (exp: Experience) =>
  parseMonthYear(exp.start_date) !== null && (exp.current || parseMonthYear(exp.end_date) !== null);

/**
 * Years covered by these roles, as a CV reads them: the start and end months
 * both count ("January 2015 to December 2019" is five years), overlaps count
 * once, a current role runs through this month.
 */
export function yearsOfExperience(experiences: Experience[], now: Date = new Date()): number {
  const nowMonth = now.getFullYear() * 12 + now.getMonth();
  const spans = experiences
    .flatMap(exp => {
      const start = monthIndex(exp.start_date, 'start');
      const end = exp.current ? nowMonth : monthIndex(exp.end_date, 'end');
      if (start === null || end === null || Math.floor(end / 12) < Math.floor(start / 12)) return [];
      // The middles of "2019 - 2019" cross: the role still counts a month
      return [[start, Math.max(start, end)] as const];
    })
    .sort((a, b) => a[0] - b[0]);
  let months = 0;
  let reached = -Infinity;
  for (const [start, end] of spans) {
    const from = Math.max(start, reached + 1);
    if (end >= from) months += end - from + 1;
    reached = Math.max(reached, end);
  }
  return months / 12;
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
    const has = (text: PreparedText) => [requirement.label, ...requirement.variants].some(term => matchPhrase(term, text));
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
