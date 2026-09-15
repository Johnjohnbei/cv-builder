// ─── ATS score: the offer's requirements against what the CV prints ───
// Pure, and imported by the Convex functions too: relative imports only (the
// Convex bundler does not resolve the "@/" alias), types imported as types.

import type {
  ATSReport, CVData, CVSection, DesignSettings, Experience, JobRequirement, ReadabilityCheck, RequirementCoverage,
} from '../../../shared/types';
import { normalizeForMatch } from '../../../shared/lib/text';
import { getActionBullets, getIntro, getVisibleSkills, isHidden, isSkillHidden, shouldShowKPI } from './displayModes';

// ─── Word-boundary matching ───

/**
 * Test if a keyword is present in text using word-boundary regex.
 * Prevents false positives (e.g., "Java" != "JavaScript"). Case-insensitive.
 */
function matchKeyword(keyword: string, text: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\b|\\s)${escaped}(?:\\b|\\s|$)`, 'i');
  return re.test(text);
}

/**
 * Strip common FR/EN suffixes for lightweight stemming.
 *
 * Scope (intentionally minimal):
 *   - Plural normalization:  -s / -es / -x
 *   - EN present participle: -ing
 *   - FR profession suffix:  -eur / -eurs
 *
 * NOT covered: FR verb conjugations (gestion ↔ gère), synonyms and
 * abbreviations (React ↔ ReactJS: that is what requirement variants are for),
 * typos.
 *
 * Preserves roots ≥ 3 chars after stripping to avoid over-reduction
 * (e.g., "les" stays "les", "iOS" stays "iOS").
 */
export function stripSimpleSuffixes(word: string): string {
  if (word.length < 4) return word;
  // A trailing -e goes last: without it "systemes" stemmed to "system" but
  // "systeme" stayed "systeme", so a singular never matched its own plural.
  const suffixes = ['ings', 'ing', 'eurs', 'eur', 'es', 's', 'x', 'e'];
  for (const suf of suffixes) {
    if (word.length - suf.length >= 3 && word.endsWith(suf)) {
      return word.slice(0, -suf.length);
    }
  }
  return word;
}

/** Stem a normalized phrase token-by-token (skip tokens < 4 chars). */
function stemPhrase(s: string): string {
  return s
    .split(/\s+/)
    .map(t => (t.length >= 4 ? stripSimpleSuffixes(t) : t))
    .join(' ');
}

/**
 * The three views of a haystack needed by matching, built once per text
 * instead of once per (term, text) pair.
 */
export interface PreparedText {
  raw: string;
  normalized: string;
  stemmed: string;
}

export function prepareText(text: string): PreparedText {
  const normalized = normalizeForMatch(text);
  return { raw: text, normalized, stemmed: stemPhrase(normalized) };
}

/**
 * Contiguous phrase match, tolerant to accents, typography and plural/suffix
 * variants. Word order and adjacency are kept: "equipe design" must not match
 * an "équipe" in one paragraph and a "design" in another.
 */
export function matchPhrase(phrase: string, text: PreparedText): boolean {
  const normalized = normalizeForMatch(phrase);
  if (!normalized) return false;
  return matchKeyword(normalized, text.normalized)
    || matchKeyword(stemPhrase(normalized), text.stemmed);
}

// ─── What an ATS reads ───

/**
 * 'rendered': what the templates print, display modes applied, so what the PDF
 * carries. 'content': every experience, bullet, KPI and skill, for a CV no one
 * has fitted to its pages yet (the output of an AI generation).
 */
export type CVTextView = 'rendered' | 'content';

/** The Design toggle (includedSections) each part of the CV belongs to */
const SECTION_TOGGLE: Record<CVSection, string> = {
  title: 'personal', summary: 'summary', experience: 'experience',
  skills: 'skills', education: 'education', languages: 'languages',
};

type IncludedSections = Pick<DesignSettings, 'includedSections'>;

const isShown = (section: CVSection, design?: IncludedSections) =>
  !design?.includedSections || design.includedSections.includes(SECTION_TOGGLE[section]);

function experienceText(exp: Experience, view: CVTextView): (string | undefined)[] {
  if (view === 'content') return [exp.position, exp.company, exp.intro, ...exp.description, exp.kpi];
  if (isHidden(exp)) return [];
  return [exp.position, exp.company, getIntro(exp) ?? undefined, ...getActionBullets(exp), shouldShowKPI(exp) ? exp.kpi : undefined];
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
  const raw: Record<CVSection, (string | undefined)[]> = {
    title: [cv.personal_info.title],
    summary: [cv.personal_info.summary],
    experience: cv.experience.flatMap(exp => experienceText(exp, view)),
    skills: cv.skills.flatMap(cat => {
      if (view === 'content') return [cat.category, ...cat.items];
      return isSkillHidden(cat) ? [] : [cat.category, ...getVisibleSkills(cat)];
    }),
    education: cv.education.flatMap(edu => [edu.degree, edu.field, edu.school]),
    languages: cv.languages.map(lang => lang.name),
  };
  const sections = {} as Record<CVSection, string[]>;
  for (const section of Object.keys(raw) as CVSection[]) {
    sections[section] = isShown(section, design)
      ? raw[section].filter((text): text is string => Boolean(text?.trim()))
      : [];
  }
  return sections;
}

// ─── Years of experience ───

/** "2019", "2019-03" or "2019-3" as a month count, null when there is no year */
function monthIndex(date: string | undefined): number | null {
  const m = date?.match(/(\d{4})(?:-(\d{1,2}))?/);
  return m ? Number(m[1]) * 12 + (m[2] ? Number(m[2]) - 1 : 0) : null;
}

/** Years covered by these roles, overlaps counted once, a current role until `now`. */
export function yearsOfExperience(experiences: Experience[], now: Date = new Date()): number {
  const nowMonth = now.getFullYear() * 12 + now.getMonth();
  const spans = experiences
    .flatMap(exp => {
      const start = monthIndex(exp.start_date);
      const end = exp.current ? nowMonth : monthIndex(exp.end_date);
      return start !== null && end !== null && end > start ? [[start, end] as const] : [];
    })
    .sort((a, b) => a[0] - b[0]);
  let months = 0;
  let reached = -Infinity;
  for (const [start, end] of spans) {
    const from = Math.max(start, reached);
    if (end > from) months += end - from;
    reached = Math.max(reached, end);
  }
  return months / 12;
}

// ─── The score ───

/** A title filters candidates first; a soft skill is never what decides */
function weightOf(r: JobRequirement): number {
  if (r.kind === 'soft_skill') return 1;
  return r.kind === 'title' || r.importance === 'required' ? 3 : 1;
}

/** "Sr.", "Mgr", "Dev.": a parser matching job titles misses them */
const ABBREVIATED_TITLE = /\b(sr|jr|mgr|dir|asst)\b\.?|\bdev\./i;

export interface ATSReportOptions {
  view?: CVTextView;
  design?: IncludedSections;
  now?: Date;
}

/**
 * Weighted share of the offer's requirements present in the CV, as an ATS
 * searches them, plus the checks a parser needs. No correction factor: the
 * score can be recounted by hand from the list.
 */
export function computeATSReport(cv: CVData, requirements: JobRequirement[], options: ATSReportOptions = {}): ATSReport {
  const { view = 'rendered', design, now } = options;
  const sections = cvSections(cv, view, design);
  const experiences = experiencesInView(cv, view, design);
  const prepared = Object.fromEntries(
    (Object.keys(sections) as CVSection[]).map(section => [section, prepareText(sections[section].join(' | '))]),
  ) as Record<CVSection, PreparedText>;
  const positions = prepareText(experiences.map(exp => exp.position).join(' | '));

  const coverage = requirements.map((requirement): RequirementCoverage => {
    const has = (text: PreparedText) => [requirement.label, ...requirement.variants].some(term => matchPhrase(term, text));
    const where = (candidates: CVSection[]) => candidates.filter(section => has(prepared[section]));
    let found: CVSection[];
    switch (requirement.kind) {
      case 'experience_years':
        found = yearsOfExperience(experiences, now) >= (requirement.minYears ?? Infinity) ? ['experience'] : [];
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
    return { requirement, found: found.length > 0, sections: found };
  });

  const total = requirements.reduce((sum, r) => sum + weightOf(r), 0);
  const covered = coverage.reduce((sum, c) => sum + (c.found ? weightOf(c.requirement) : 0), 0);

  const header = isShown('title', design);
  const { email = '', phone = '', location = '', title = '' } = cv.personal_info;
  const checks: ReadabilityCheck[] = [
    { id: 'email', passed: header && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) },
    { id: 'phone', passed: header && phone.replace(/\D/g, '').length >= 7 },
    { id: 'location', passed: header && location.trim().length > 0 },
    { id: 'titles', passed: ![title, ...experiences.map(exp => exp.position)].some(t => ABBREVIATED_TITLE.test(t ?? '')) },
  ];

  return {
    score: total > 0 ? Math.round((100 * covered) / total) : null,
    requirements: coverage,
    checks,
  };
}
