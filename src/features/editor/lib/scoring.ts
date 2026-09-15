import type { Experience, JobRequirement } from '@/src/shared/types';
import { matchPhrase, prepareText } from '@/src/shared/lib/text';
import { experienceText, isWritable } from './keywordAnalysis';

// ─── Relevance of one experience to the offer ───
// Orders the fit-to-pages condensing and colours the per-experience badge. The
// ATS score of the whole CV lives in keywordAnalysis.ts (computeATSReport), and
// both read the same requirements with the same matching.

/**
 * Display bands for the per-experience relevance badge.
 *
 * The score answers "what share of the requirements an experience can prove
 * does THIS experience evidence". First calibrated on keyword lists (an
 * on-target role at 38-47 %, an off-target one at 9-15 % carried by recency);
 * requirement lists are shorter and all provable, so an on-target role lands
 * higher. The bands are kept low on purpose, and a test locks a representative
 * offer: on-target role high, off-target current role low.
 *
 * This calibrates the DISPLAY only. No factor is injected into the score, which
 * stays verifiable by counting matched requirements. Keep it so.
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
export function scoreExperience(exp: Experience, requirements: JobRequirement[]): number {
  const recency = computeRecency(exp);
  if (!requirements.some(isWritable)) {
    return Math.round(recency * 0.6 + computeDuration(exp) * 0.4);
  }
  const relevance = computeRequirementMatch(exp, requirements);
  return Math.round(relevance * RELEVANCE_WEIGHT + recency * (1 - RELEVANCE_WEIGHT));
}

/**
 * Share of the requirements an experience can prove (not a degree, a language
 * or a number of years) that its whole text evidences, with the matching of
 * the ATS score: variants, accents, plurals, word boundaries.
 */
export function computeRequirementMatch(exp: Experience, requirements: JobRequirement[]): number {
  const provable = requirements.filter(isWritable);
  if (provable.length === 0) return 0;
  const text = prepareText(experienceText(exp, 'content').join(' | '));
  const hits = provable.filter(r => [r.label, ...r.variants].some(term => matchPhrase(term, text))).length;
  return Math.round((hits / provable.length) * 100);
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
