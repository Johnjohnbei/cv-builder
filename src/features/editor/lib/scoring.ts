import type { Experience, ExperienceDisplayMode, CVData, DesignSettings } from '@/src/shared/types';
import { TEMPLATE_ATS_COMPAT, ATS_SAFE_FONTS, WEAK_VERBS } from './atsRules';

// --- Keyword Extraction ---

const STOP_WORDS = new Set([
  'les', 'des', 'une', 'pour', 'dans', 'avec', 'sur', 'par', 'est', 'sont', 'qui', 'que',
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'will', 'been',
  'vous', 'nous', 'être', 'avoir', 'tout', 'plus', 'très', 'votre', 'notre',
  'not', 'but', 'all', 'can', 'has', 'her', 'his', 'its', 'may', 'our', 'she',
]);

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

// --- Relevance Scoring ---

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
 * Match experience text against keywords using word-boundary regex.
 * Handles special characters (C++, C#, .NET, Node.js) via regex escaping.
 */
export function computeKeywordMatch(exp: Experience, keywords: string[]): number {
  const text = [exp.position, exp.company, ...(exp.description || [])].join(' ').toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    // Escape regex special chars (handles C++, C#, .NET, Node.js)
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Word-boundary matching: \b for ASCII, lookaround for accented chars
    const re = new RegExp(`(?:^|\\b|\\s)${escaped}(?:\\b|\\s|$)`, 'i');
    if (re.test(text)) hits++;
  }
  return Math.min(100, Math.round((hits / Math.max(1, keywords.length)) * 100));
}

/** Score based on how recent the experience is (0-100). */
export function computeRecency(exp: Experience): number {
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

/** Score based on experience duration (0-100). */
export function computeDuration(exp: Experience): number {
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

// --- Auto-Assign Display Modes ---

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

// --- ATS Format Scoring ---

/** Internal sub-score result type. */
export interface SubScoreResult {
  score: number;
  suggestions: string[];
}

/** Map design fontFamily values to actual font names. */
const FONT_FAMILY_MAP: Record<string, string> = {
  sans: 'Arial',
  serif: 'Georgia',
  mono: 'Courier New',
  playfair: 'Playfair Display',
  outfit: 'Outfit',
};

/** Regex for metrics in bullet points: numbers, %, $, euro. */
const METRICS_REGEX = /\d+%|\$[\d,.]+|€[\d,.]+|\d{2,}/;

/** Check if email is present and valid. */
function hasEmail(email?: string): boolean {
  return !!email && email.includes('@');
}

/** Check if phone has 7+ digits. */
function hasPhone(phone?: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7;
}

/** Check if font is ATS-safe. */
function isFontATSSafe(fontFamily: string): boolean {
  const fontName = FONT_FAMILY_MAP[fontFamily] ?? fontFamily;
  return (ATS_SAFE_FONTS as readonly string[]).includes(fontName);
}

/** Check if a bullet contains quantifiable metrics. */
function bulletHasMetrics(bullet: string): boolean {
  return METRICS_REGEX.test(bullet);
}

/** Check if a bullet starts with a weak verb. */
function bulletStartsWithWeakVerb(bullet: string, language: 'fr' | 'en'): boolean {
  const lower = bullet.toLowerCase().trim();
  return WEAK_VERBS[language].weak.some(v => lower.startsWith(v));
}

/** Check if bullet word count is in the 5-30 range. */
function isBulletLengthOK(bullet: string): boolean {
  const words = bullet.trim().split(/\s+/).length;
  return words >= 5 && words <= 30;
}

/**
 * Score the format/structure of a CV for ATS compatibility (0-100).
 * Checks: template compat, section names, font safety, contact info.
 * Pure function, no side effects.
 */
export function scoreFormat(cvData: CVData, design: DesignSettings, language: 'fr' | 'en'): SubScoreResult {
  const suggestions: string[] = [];
  let score = 0;

  // Template ATS compat (25 pts)
  const compat = TEMPLATE_ATS_COMPAT[design.template];
  if (compat === 'full') {
    score += 25;
  } else if (compat === 'limited') {
    score += 10;
    suggestions.push('Consider using a single-column ATS-friendly template');
  } else {
    suggestions.push('Unknown template — ATS compatibility uncertain');
  }

  // Section names (25 pts)
  const essentialSections = ['experience', 'education', 'skills', 'contact', 'summary'];
  const included = design.includedSections ?? [];
  const sectionCount = essentialSections.filter(s => included.includes(s)).length;
  const sectionScore = Math.round((sectionCount / essentialSections.length) * 25);
  score += sectionScore;
  if (sectionCount < essentialSections.length) {
    const missing = essentialSections.filter(s => !included.includes(s));
    suggestions.push(`Missing sections: ${missing.join(', ')}`);
  }

  // Font safety (25 pts)
  if (isFontATSSafe(design.fontFamily)) {
    score += 25;
  } else {
    suggestions.push('Use an ATS-safe font (Arial, Calibri, Helvetica, Times New Roman, Georgia)');
  }

  // Contact info (25 pts)
  if (hasEmail(cvData.personal_info.email)) {
    score += 12.5;
  } else {
    suggestions.push('Add a valid email address');
  }
  if (hasPhone(cvData.personal_info.phone)) {
    score += 12.5;
  } else {
    suggestions.push('Add a phone number');
  }

  // SVG icon check placeholder per D-05: assume no icons = full points (0 pts allocated)

  return { score: Math.round(Math.max(0, Math.min(100, score))), suggestions };
}

// --- ATS Content Scoring ---

/**
 * Score the content quality of a CV for ATS (0-100).
 * Checks: metrics in bullets, strong verbs, bullet length, essential sections, skills.
 * Pure function, no side effects.
 */
export function scoreContent(cvData: CVData, language: 'fr' | 'en'): SubScoreResult {
  const suggestions: string[] = [];

  // Collect all bullet points
  const bullets = cvData.experience.flatMap(exp => exp.description ?? []);
  if (bullets.length === 0) {
    return { score: 0, suggestions: ['Add experience bullet points'] };
  }

  let score = 0;

  // Metrics check (25 pts): % of bullets with metrics, target >= 50%
  const metricsCount = bullets.filter(bulletHasMetrics).length;
  const metricsRatio = metricsCount / bullets.length;
  const metricsScore = Math.round(Math.min(metricsRatio / 0.5, 1) * 25);
  score += metricsScore;
  if (metricsRatio < 0.5) {
    suggestions.push('Add quantifiable metrics (numbers, %, $) to more bullet points');
  }

  // Weak verb check (25 pts): % of bullets NOT starting with weak verb
  const weakCount = bullets.filter(b => bulletStartsWithWeakVerb(b, language)).length;
  const strongRatio = (bullets.length - weakCount) / bullets.length;
  score += Math.round(strongRatio * 25);
  if (weakCount > 0) {
    suggestions.push('Replace weak verbs (helped, worked on, assisted) with strong action verbs');
  }

  // Bullet length check (20 pts): % of bullets with 5-30 words
  const goodLengthCount = bullets.filter(isBulletLengthOK).length;
  score += Math.round((goodLengthCount / bullets.length) * 20);
  if (goodLengthCount < bullets.length) {
    suggestions.push('Keep bullet points between 5-30 words');
  }

  // Essential sections check (15 pts): infer from data
  let sectionPoints = 0;
  if (cvData.experience.length > 0) sectionPoints += 3.75;
  if (cvData.education.length > 0) sectionPoints += 3.75;
  if (cvData.skills.length > 0) sectionPoints += 3.75;
  if (cvData.personal_info.summary) sectionPoints += 3.75;
  score += Math.round(sectionPoints);
  if (sectionPoints < 15) {
    suggestions.push('Include all essential sections: experience, education, skills, summary');
  }

  // Skills not empty (15 pts)
  if (cvData.skills.length > 0 && cvData.skills.some(s => s.items.length > 0)) {
    score += 15;
  } else {
    suggestions.push('Add skills to improve ATS keyword matching');
  }

  return { score: Math.max(0, Math.min(100, score)), suggestions };
}
