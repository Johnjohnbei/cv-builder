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
