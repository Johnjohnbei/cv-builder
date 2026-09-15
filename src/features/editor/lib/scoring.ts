import type { Experience } from '@/src/shared/types';

// ─── Relevance of one experience to the offer ───
// Orders the fit-to-pages condensing and colours the per-experience badge. The
// ATS score of the whole CV lives in keywordAnalysis.ts (computeATSReport).

/**
 * Display bands for the per-experience relevance badge.
 *
 * Deliberately far lower than they look, and measured rather than guessed. The
 * score answers "what share of the offer's requirements does THIS experience
 * evidence", and no single experience covers a whole posting. Across two real
 * offers, run through the real keyword pipeline:
 *
 *   - a perfectly on-target experience lands at 38-47 %
 *     (38 % against the 21-term AI list, 47 % against the 40-term NLP fallback:
 *      the AI terms are multi-word and harder to match literally)
 *   - an off-target experience lands at 9-15 %, carried only by its recency
 *
 * With the usual 70/40 bands the best experience for the job rendered red. A
 * first attempt at 55 was calibrated on a hand-picked keyword list, which is the
 * same selection bias that produced a wrong diagnosis on the provider chain the
 * day before: bands belong on measured distributions, not on convenient ones.
 *
 * This calibrates the DISPLAY only. No factor is injected into the score, which
 * stays verifiable by counting matches against the keyword list. Keep it so.
 */
export const RELEVANCE_BAND_HIGH = 35;
export const RELEVANCE_BAND_MEDIUM = 18;

export type RelevanceBand = 'high' | 'medium' | 'low';

/** Which display band a per-experience relevance score falls into. */
export function relevanceBand(score: number): RelevanceBand {
  if (score >= RELEVANCE_BAND_HIGH) return 'high';
  if (score >= RELEVANCE_BAND_MEDIUM) return 'medium';
  return 'low';
}

/** Weight of fit-to-position once an offer is known. Recency is the remainder. */
const RELEVANCE_WEIGHT = 0.85;

/**
 * How well an experience fits the position (0-100).
 *
 * With an offer, fit dominates and recency is only a tiebreaker. The previous
 * split (relevance 0.50 / recency 0.35 / duration 0.15) let recency carry an
 * off-target experience almost as high as a perfect match: measured on a "Lead
 * Design System" offer, a Head of Marketing role with 0 % relevance scored
 * 46 % against 53 % for the exactly-matching role. Seven points apart, for two
 * experiences that have nothing in common. At 0.85 the same pair splits 15 %
 * against ~58 %, which is the ordering the user reads on the badge and the one
 * the fit pass must act on.
 *
 * Recency keeps its 15 % on purpose: between two comparably relevant roles, the
 * recent one belongs first, which is what a recruiter expects.
 *
 * Without an offer there is no fit to measure, so recency and duration are all
 * that is left to rank on.
 */
export function scoreExperience(exp: Experience, jobKeywords: string[]): number {
  const recency = computeRecency(exp);
  if (jobKeywords.length === 0) {
    return Math.round(recency * 0.6 + computeDuration(exp) * 0.4);
  }
  const relevance = computeKeywordMatch(exp, jobKeywords);
  return Math.round(relevance * RELEVANCE_WEIGHT + recency * (1 - RELEVANCE_WEIGHT));
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
