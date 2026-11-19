// ─── Years of experience, as a CV's dates add them up ───
// Extracted from keyword-analysis.ts, over its size limit. Pure, and imported by
// the Convex functions too: relative imports only.

import type { Experience } from '../../../shared/types';
import { parseMonthYear } from './formatting';

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
export const hasReadableDates = (exp: Experience) =>
  parseMonthYear(exp.start_date) !== null && (exp.current || parseMonthYear(exp.end_date) !== null);

/**
 * How many pages a CV is worth, read from its own dates.
 *
 * The usual rule of a French CV, and the one recruiters state: one page under
 * about eight years of work, two beyond. It is a starting point the user
 * changes in the Design panel, never a cap applied behind their back.
 */
export function suggestedPageLimit(experiences: Experience[], now?: Date): number {
  return yearsOfExperience(experiences, now) < 8 ? 1 : 2;
}

/**
 * Whether every role writes its dates with the same precision: all of them
 * with a month, or none of them.
 *
 * Greenhouse names it among the resumes it cannot parse ("resumes without
 * clear sections and differing formats throughout each section"): the check on
 * each role apart passed on a CV mixing "2019" and "mars 2021", because both
 * are readable on their own. A role with no readable date at all is left to
 * the `dates` check, which already reports it.
 */
export function hasHomogeneousDates(experiences: Experience[]): boolean {
  const written = experiences.filter(hasReadableDates);
  if (written.length === 0) return false;
  const months = written.flatMap(exp => [
    parseMonthYear(exp.start_date)?.month,
    ...(exp.current ? [] : [parseMonthYear(exp.end_date)?.month]),
  ]);
  return months.every(month => month !== null) || months.every(month => month === null);
}

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
      if (start === null || end === null) return [];
      // The middles of "2019 - 2019" cross, and the role still counts a month;
      // with both months known, an end before the start is a typo
      const bareYear = parseMonthYear(exp.start_date)?.month === null || (!exp.current && parseMonthYear(exp.end_date)?.month === null);
      const crossedMiddles = bareYear && Math.floor(end / 12) === Math.floor(start / 12);
      if (end < start && !crossedMiddles) return [];
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

// ─── The years an ATS reads ───
// A parser looking for "10+ years of experience" finds nothing in a CV that
// only carries dates: the years are counted here and written where both a
// human and a parser read them (the header line and the summary's first
// sentence). Always the CV's own dates, rounded DOWN: a career is never
// overstated by a rounding.

/** The whole years these roles add up to, 0 when their dates cannot be read */
export function statedExperienceYears(experiences: Experience[], now?: Date): number {
  return Math.floor(yearsOfExperience(experiences.filter(hasReadableDates), now));
}

/** Under two years the mention says nothing a recruiter wants to read, and an ATS filters on none */
const MIN_STATED_YEARS = 2;

/** The one wording of the mention, printed by the header, the Word export and the summary */
export const experienceYearsText = (years: number, language: 'fr' | 'en'): string =>
  language === 'en' ? `${years} years of experience` : `${years} ans d'expérience`;

/** "12 ans d'expérience" / "12 years of experience", or nothing when the CV cannot back it */
export function experienceYearsLabel(experiences: Experience[], language: 'fr' | 'en', now?: Date): string | null {
  const years = statedExperienceYears(experiences, now);
  return years < MIN_STATED_YEARS ? null : experienceYearsText(years, language);
}

/** Whether these roles state enough years for the mention to be printed */
export const statesEnoughYears = (years: number): boolean => years >= MIN_STATED_YEARS;

/**
 * The line a CV prints under its title: what the user wrote there, else the
 * years its own dates add up to, and an empty string when the user cleared it
 * or the dates say too little. The one owner, read by the preview, the PDF
 * header, the Word export and the summary.
 */
export function experienceYearsIn(
  cv: { personal_info: { experience_years?: string }; experience: Experience[] },
  language: 'fr' | 'en',
  now?: Date,
): string {
  return experienceYearsHeadline({ ...cv.personal_info, years: statedExperienceYears(cv.experience, now) }, language);
}

/**
 * The same line from what a header block carries: the user's own text when the
 * CV holds one, else the whole years counted from its dates.
 */
export function experienceYearsHeadline(header: { experience_years?: string; years?: number }, language: 'fr' | 'en'): string {
  if (header.experience_years !== undefined) return header.experience_years.trim();
  return header.years !== undefined && statesEnoughYears(header.years) ? experienceYearsText(header.years, language) : '';
}

/** Whether a text already states a number of years, in either language: the mention is never written twice */
export function statesExperienceYears(text: string | undefined): boolean {
  return /\b\d{1,2}\s*(?:\+\s*)?(?:ans?|années?|years?|yrs?)\b/iu.test(text ?? '');
}
