import type { Experience, ExperienceDisplayMode } from '@/src/shared/types';

// ─── Date formatting ───

const MONTH_MAP_FR: Record<string, string> = {
  'janvier': 'Janv.', 'février': 'Fév.', 'mars': 'Mars', 'avril': 'Avr.',
  'mai': 'Mai', 'juin': 'Juin', 'juillet': 'Juil.', 'août': 'Août',
  'septembre': 'Sept.', 'octobre': 'Oct.', 'novembre': 'Nov.', 'décembre': 'Déc.',
  'january': 'Jan.', 'february': 'Feb.', 'march': 'Mar.', 'april': 'Apr.',
  'may': 'May', 'june': 'Jun.', 'july': 'Jul.', 'august': 'Aug.',
  'september': 'Sep.', 'october': 'Oct.', 'november': 'Nov.', 'december': 'Dec.',
  'jan': 'Jan.', 'feb': 'Fév.', 'mar': 'Mars', 'apr': 'Avr.',
  'jun': 'Juin', 'jul': 'Juil.', 'aug': 'Août', 'sep': 'Sept.', 'oct': 'Oct.', 'nov': 'Nov.', 'dec': 'Déc.',
};

/**
 * Shorten a date string for CV display.
 * "Septembre 2021" → "Sept. 2021"
 * "2021" → "2021"
 * "01/2021" → "Jan. 2021"
 * "2021-09" → "Sept. 2021"
 */
export function formatDateShort(date?: string): string {
  if (!date) return '';
  const d = date.trim();

  // Pure year
  if (/^\d{4}$/.test(d)) return d;

  // "Month Year" or "Month. Year"
  for (const [long, short] of Object.entries(MONTH_MAP_FR)) {
    const re = new RegExp(`^${long}\\.?\\s*(\\d{4})$`, 'i');
    const m = d.match(re);
    if (m) return `${short} ${m[1]}`;
  }

  // "MM/YYYY" or "MM-YYYY"
  const slashMatch = d.match(/^(\d{1,2})[/\-](\d{4})$/);
  if (slashMatch) {
    const monthNum = parseInt(slashMatch[1], 10);
    const monthNames = ['Jan.', 'Fév.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    return `${monthNames[monthNum - 1] || ''} ${slashMatch[2]}`;
  }

  // "YYYY-MM"
  const isoMatch = d.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMatch) {
    const monthNum = parseInt(isoMatch[2], 10);
    const monthNames = ['Jan.', 'Fév.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    return `${monthNames[monthNum - 1] || ''} ${isoMatch[1]}`;
  }

  return d; // return as-is if no pattern matches
}

// ─── Relevance scoring ───

/**
 * Score an experience's relevance to a job description (0-100).
 * Pure logic, no AI. Based on keyword matching + recency + duration.
 */
export function scoreExperience(exp: Experience, jobKeywords: string[]): number {
  const recency = computeRecency(exp);
  const relevance = jobKeywords.length > 0 ? computeKeywordMatch(exp, jobKeywords) : 50;
  const duration = computeDuration(exp);

  // Weighted: relevance matters most when job desc is available
  return jobKeywords.length > 0
    ? Math.round(relevance * 0.5 + recency * 0.35 + duration * 0.15)
    : Math.round(recency * 0.6 + duration * 0.4);
}

/**
 * Auto-assign displayModes to experiences based on scores + page budget.
 * Returns a new array with displayMode set. Does NOT mutate input.
 */
export function autoAssignModes(
  experiences: Experience[],
  jobKeywords: string[],
  pageLimit: number,
): Experience[] {
  const scored = experiences.map((exp, idx) => ({
    exp,
    idx,
    score: scoreExperience(exp, jobKeywords),
  }));

  // Sort by score descending to assign modes
  const sorted = [...scored].sort((a, b) => b.score - a.score);

  // Budget heuristics: how many experiences can fit on N pages
  // 1 page: ~5 visible (1 extended + 1 normal + 3 compact)
  // 2 pages: ~10 visible (2 extended + 3 normal + 5 compact)
  // 3-4 pages: ~15 visible
  const maxVisible = Math.min(experiences.length, pageLimit <= 1 ? 4 : pageLimit <= 2 ? 8 : 12);
  const extendedBudget = pageLimit <= 1 ? 1 : Math.min(pageLimit, 3);
  const normalBudget = pageLimit <= 1 ? 1 : Math.min(pageLimit + 1, maxVisible - extendedBudget);

  const result = new Array<Experience>(experiences.length);

  sorted.forEach(({ exp, idx, score }, rank) => {
    let mode: ExperienceDisplayMode;
    if (rank >= maxVisible || score < 15) {
      mode = 'hidden';
    } else if (rank < extendedBudget) {
      mode = 'extended';
    } else if (rank < extendedBudget + normalBudget) {
      mode = 'normal';
    } else {
      mode = 'compact';
    }
    result[idx] = { ...exp, displayMode: mode };
  });

  return result;
}

/**
 * Extract keywords from a job description for scoring.
 * Pure text processing, no AI.
 */
export function extractKeywords(jobDescription: string): string[] {
  if (!jobDescription) return [];
  return [...new Set(
    jobDescription
      .toLowerCase()
      .replace(/[^a-zà-ÿ0-9\s+#.]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3)
      // Filter out ultra-common French/English stop words
      .filter(w => !STOP_WORDS.has(w))
  )];
}

// ─── Internal helpers ───

function computeRecency(exp: Experience): number {
  const now = new Date().getFullYear();
  if (exp.current) return 100;
  const year = parseYear(exp.end_date);
  if (!year) return 30;
  const ago = now - year;
  if (ago <= 1) return 95;
  if (ago <= 3) return 80;
  if (ago <= 5) return 60;
  if (ago <= 10) return 40;
  return 20;
}

function computeKeywordMatch(exp: Experience, keywords: string[]): number {
  const text = [exp.position, exp.company, ...(exp.description || [])].join(' ').toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) hits++;
  }
  return Math.min(100, Math.round((hits / Math.max(1, keywords.length)) * 100));
}

function computeDuration(exp: Experience): number {
  const start = parseYear(exp.start_date);
  const end = exp.current ? new Date().getFullYear() : parseYear(exp.end_date);
  if (!start || !end) return 30;
  const years = end - start;
  if (years >= 5) return 90;
  if (years >= 3) return 70;
  if (years >= 1) return 50;
  return 30;
}

function parseYear(d?: string): number | null {
  if (!d) return null;
  const m = d.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

const STOP_WORDS = new Set([
  'les', 'des', 'une', 'pour', 'dans', 'avec', 'sur', 'par', 'est', 'sont', 'qui', 'que',
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'will', 'been',
  'vous', 'nous', 'être', 'avoir', 'tout', 'plus', 'très', 'votre', 'notre',
  'not', 'but', 'all', 'can', 'has', 'her', 'his', 'its', 'may', 'our', 'she',
]);
