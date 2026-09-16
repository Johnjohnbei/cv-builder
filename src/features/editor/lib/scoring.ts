import type { Experience, JobRequirement } from '@/src/shared/types';
import type { SupportedLanguage } from '@/src/lib/languageDetection';
import { prepareText } from '@/src/shared/lib/text';
import { experienceText, isWritable, writesRequirement } from './keywordAnalysis';

// ─── Relevance of one experience to the offer ───
// The badge shows the requirement coverage; the fit-to-pages condensing orders
// on it with recency as a tiebreaker. The ATS score of the whole CV lives in
// keywordAnalysis.ts (computeATSReport), and all read the same requirements
// with the same matching.

/**
 * Display bands for the per-experience badge, which shows the share of the
 * provable requirements (computeRequirementMatch) a role evidences. Half of
 * them is a role on target; one in seven is not. A test locks a representative
 * offer: on-target role high, partial role medium, off-target role at 0.
 *
 * This calibrates the DISPLAY only. No factor is injected into the share, which
 * stays verifiable by counting matched requirements. Keep it so.
 */
export const RELEVANCE_BAND_HIGH = 50;
export const RELEVANCE_BAND_MEDIUM = 20;

export type RelevanceBand = 'high' | 'medium' | 'low';

/** Which display band a requirement coverage falls into. */
export function relevanceBand(score: number): RelevanceBand {
  if (score >= RELEVANCE_BAND_HIGH) return 'high';
  if (score >= RELEVANCE_BAND_MEDIUM) return 'medium';
  return 'low';
}

/** Weight of fit-to-position once an offer is known. Recency is the remainder. */
const RELEVANCE_WEIGHT = 0.85;

/**
 * How well an experience fits the position (0-100), ordering the fit to pages.
 * Never shown: the badge shows the coverage alone, recency would make a role
 * proving nothing read "15 %".
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
export function scoreExperience(exp: Experience, requirements: JobRequirement[], language: SupportedLanguage = 'fr'): number {
  const recency = computeRecency(exp);
  if (!requirements.some(isWritable)) {
    return Math.round(recency * 0.6 + computeDuration(exp) * 0.4);
  }
  const relevance = computeRequirementMatch(exp, requirements, language);
  return Math.round(relevance * RELEVANCE_WEIGHT + recency * (1 - RELEVANCE_WEIGHT));
}

/**
 * Share of the requirements an experience can prove (not a degree, a language
 * or a number of years) that its whole text evidences, with the rules of the
 * ATS score: variants, accents, plurals, word boundaries, company tags in the
 * CV's language, a job title in the position only.
 */
export function computeRequirementMatch(exp: Experience, requirements: JobRequirement[], language: SupportedLanguage = 'fr'): number {
  const provable = requirements.filter(isWritable);
  if (provable.length === 0) return 0;
  const text = prepareText(experienceText(exp, 'content', language).join(' | '));
  const position = prepareText(exp.position ?? '');
  // The same reading as the score's, so a badge and the score never disagree
  const hits = provable.filter(r => writesRequirement([r.kind === 'title' ? position : text], r)).length;
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
