// ─── Fit-to-N-pages ───
// Pure step functions that reproduce, deterministically, the manual triage a
// candidate does to squeeze a CV onto two pages: start every experience at its
// richest, then keep taking one notch off the least valuable one until the
// pagination engine reports the target page count.
//
// Measuring is the caller's job (only the live DOM knows real heights) —
// useFitToPages drives the loop. Everything here is pure and testable.
//
// The relevance score is used ONLY to order the condensing, never to decide an
// absolute level. An earlier version banded scores into "this one deserves
// extended, that one compact" and it under-filled badly: scoreExperience
// divides keyword hits by the whole keyword list, so against a real job
// description almost every role lands under 50 and the CV started already
// condensed, with nothing left for the loop to give back (measured then on
// keyword lists; the requirement lists keep the same rule). Relative ranking is
// what the score is good at; absolute calibration is what the page budget is
// for.

import type { Experience, ExperienceDisplayMode, JobRequirement } from '@/src/shared/types';
import type { SupportedLanguage } from '@/src/lib/languageDetection';
import { matchPhrase, prepareText } from '@/src/shared/lib/text';
import { experienceText } from './keywordAnalysis';
import { scoreExperience } from './scoring';

/** Display modes ordered from richest to leanest. Condensing walks it forward. */
const LADDER: ExperienceDisplayMode[] = ['extended', 'normal', 'compact', 'hidden'];
const HIDDEN_RUNG = LADDER.indexOf('hidden');

function rung(mode: ExperienceDisplayMode | undefined): number {
  const i = LADDER.indexOf(mode ?? 'normal');
  return i === -1 ? LADDER.indexOf('normal') : i;
}

/**
 * Reset every experience to its richest rendering.
 *
 * The starting point of a fit pass, deliberately over-generous: the condensing
 * loop below walks back down only as far as the page budget demands, so the
 * result is the richest CV that still fits rather than an arbitrary guess.
 */
export function expandToMax(experiences: Experience[]): Experience[] {
  return experiences.map(exp => ({ ...exp, displayMode: LADDER[0] }));
}

/** The requirements one experience writes as the CV prints it at its current rung */
function writtenBy(exp: Experience, requirements: JobRequirement[], language: SupportedLanguage): Set<string> {
  const fields = experienceText(exp, 'rendered', language).map(prepareText);
  return new Set(requirements
    .filter(r => [r.label, ...r.variants].some(term => fields.some(field => matchPhrase(term, field))))
    .map(r => r.id));
}

/**
 * Take exactly one notch off the least valuable experience.
 *
 * Candidates are restricted to the experiences currently at the RICHEST rung
 * still in use, so the CV comes down in waves: every role drops from extended
 * to normal (weakest first) before any role drops to compact, and nothing is
 * hidden until everything is already compact. That keeps the visible detail
 * within one notch across roles — a gradient, not a CV where one experience is
 * fully written up and the next has vanished.
 *
 * Within a wave, the lowest relevance score goes first; ties break on the later
 * position in the list, which is the older role.
 *
 * Returns null when every experience is hidden — the caller stops and reports
 * the real page count rather than looping.
 */
export function condenseOneStep(
  experiences: Experience[],
  requirements: JobRequirement[],
  language: SupportedLanguage = 'fr',
): Experience[] | null {
  const visible = experiences
    .map((exp, index) => ({ index, current: rung(exp.displayMode) }))
    .filter(c => c.current < HIDDEN_RUNG);

  if (visible.length === 0) return null;

  const richest = Math.min(...visible.map(c => c.current));
  const wave = visible
    .filter(c => c.current === richest)
    .map(c => ({ ...c, score: scoreExperience(experiences[c.index], requirements, language) }));

  // How many experiences write each requirement right now: a requirement the
  // offer demands must not leave the CV while another experience can come down
  // instead. Condensing is ordered by relevance; this is the one thing that
  // outranks it, and only for a required requirement.
  const required = requirements.filter(r => r.importance === 'required');
  const written = experiences.map(exp => writtenBy(exp, required, language));
  const mentions = new Map(required.map(r => [r.id, written.filter(ids => ids.has(r.id)).length]));
  const dropsTheLastMention = (candidate: { index: number; current: number }) => {
    const next = writtenBy({ ...experiences[candidate.index], displayMode: LADDER[candidate.current + 1] }, required, language);
    return [...written[candidate.index]].some(id => !next.has(id) && mentions.get(id) === 1);
  };
  const sparing = wave.filter(c => !dropsTheLastMention(c));
  // Every candidate carries one: the CV cannot fit without losing a requirement
  const candidates = sparing.length > 0 ? sparing : wave;

  const victim = candidates.reduce((best, c) => {
    if (c.score !== best.score) return c.score < best.score ? c : best;
    return c.index > best.index ? c : best;
  });

  return experiences.map((exp, i) =>
    i === victim.index ? { ...exp, displayMode: LADDER[victim.current + 1] } : exp,
  );
}

/**
 * Upper bound on condensing steps for a given CV: every experience can be
 * pushed at most from 'extended' to 'hidden'. Guards the driving loop against
 * a pagination engine that never converges.
 */
export function maxCondenseSteps(experiences: Experience[]): number {
  return experiences.length * (LADDER.length - 1);
}
