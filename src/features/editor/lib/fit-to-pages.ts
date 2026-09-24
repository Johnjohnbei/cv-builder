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

import type { CVData, Experience, ExperienceDisplayMode, JobRequirement } from '@/src/shared/types';
import type { SupportedLanguage } from '@/src/lib/language-detection';
import { prepareText } from '@/src/shared/lib/text';
import { cvSections, experienceText, isProvable, writesRequirement } from './keyword-analysis';
import { scoreExperience } from './scoring';

/** Display modes ordered from richest to leanest. Condensing walks it forward. */
const LADDER: ExperienceDisplayMode[] = ['extended', 'normal', 'compact', 'hidden'];

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
  return new Set(requirements.filter(r => writesRequirement(fields, r)).map(r => r.id));
}

/**
 * Requirements the CV writes somewhere condensing never reaches: the summary,
 * the skills, the title. Protecting their last mention in an experience would
 * spare a role for a mention the CV keeps anyway.
 */
export function writtenOutsideExperience(cv: CVData, requirements: JobRequirement[]): Set<string> {
  const sections = cvSections(cv, 'rendered');
  const fields = (Object.keys(sections) as (keyof typeof sections)[])
    .filter(section => section !== 'experience')
    .flatMap(section => sections[section])
    .map(prepareText);
  return new Set(requirements.filter(r => writesRequirement(fields, r)).map(r => r.id));
}

/** The share of the experiences, the most relevant, that keep their detail longest */
const HIGHLIGHTED_SHARE = 1 / 3;

/**
 * The order the CV comes down in (arbitrage of 2026-09-17): a CV where every
 * role was equally thin read as a list. The most relevant third keeps its
 * detail while the others come down to compact; then it comes down to normal,
 * the others are hidden, and it goes last.
 */
const STAGES: { highlighted: boolean; floor: ExperienceDisplayMode }[] = [
  { highlighted: false, floor: 'compact' },
  { highlighted: true, floor: 'normal' },
  { highlighted: false, floor: 'hidden' },
  { highlighted: true, floor: 'hidden' },
];

interface Candidate { index: number; current: number; score: number }

/**
 * Each stage's wave: its movable roles at their richest rung. A role held
 * today, dated, is highlighted whatever its score: a CV hiding the current job
 * reads as a gap to a recruiter (a role whose dates could not be read is not).
 */
function stageWaves(experiences: Experience[], scored: Candidate[]): Candidate[][] {
  const ranked = [...scored].sort((a, b) => b.score - a.score || a.index - b.index);
  const highlighted = new Set([
    ...ranked.slice(0, Math.ceil(experiences.length * HIGHLIGHTED_SHARE)).map(c => c.index),
    ...scored.filter(c => experiences[c.index].current && experiences[c.index].start_date?.trim()).map(c => c.index),
  ]);
  return STAGES.map(({ highlighted: top, floor }) => {
    const movable = scored.filter(c => highlighted.has(c.index) === top && c.current < LADDER.indexOf(floor));
    const richest = Math.min(...movable.map(c => c.current));
    return movable.filter(c => c.current === richest);
  });
}

/**
 * Whether taking a notch off a role removes the last mention of a required
 * requirement. Only what the score counts from an experience: a title is read
 * in the positions, a degree in the education, and neither moves with a rung.
 */
function lastMentionCheck(experiences: Experience[], requirements: JobRequirement[], language: SupportedLanguage, writtenElsewhere: Set<string>) {
  const required = requirements.filter(r =>
    r.importance === 'required' && isProvable(r) && !writtenElsewhere.has(r.id));
  const written = experiences.map(exp => writtenBy(exp, required, language));
  const mentions = new Map(required.map(r => [r.id, written.filter(ids => ids.has(r.id)).length]));
  return (c: Candidate) => {
    const next = writtenBy({ ...experiences[c.index], displayMode: LADDER[c.current + 1] }, required, language);
    return [...written[c.index]].some(id => !next.has(id) && mentions.get(id) === 1);
  };
}

/**
 * Take exactly one notch off the least valuable experience.
 *
 * The experiences are split by relevance: the best third, and every role held
 * today, is highlighted and keeps its detail while the others come down (STAGES). Within a stage the CV
 * comes down in waves, the richest rung first, and the lowest relevance score
 * goes first; ties break on the later position in the list, the older role.
 *
 * One rule outranks the stages: a required requirement does not leave the CV
 * while another experience can come down instead.
 *
 * Returns null when every experience is hidden — the caller stops and reports
 * the real page count rather than looping.
 */
export function condenseOneStep(
  experiences: Experience[],
  requirements: JobRequirement[],
  language: SupportedLanguage = 'fr',
  /** Requirements the rest of the CV writes: condensing an experience cannot take them away */
  writtenElsewhere: Set<string> = new Set(),
): Experience[] | null {
  const scored = experiences.map((exp, index) => ({
    index, current: rung(exp.displayMode), score: scoreExperience(exp, requirements, language),
  }));
  const waves = stageWaves(experiences, scored);
  const dropsTheLastMention = lastMentionCheck(experiences, requirements, language, writtenElsewhere);
  const lowest = (candidates: Candidate[]) => candidates.reduce((best, c) => {
    if (c.score !== best.score) return c.score < best.score ? c : best;
    return c.index > best.index ? c : best;
  });
  const sparing = waves.map(wave => wave.filter(c => !dropsTheLastMention(c))).find(wave => wave.length > 0);
  // Every candidate carries one: the CV cannot fit without losing a requirement
  const candidates = sparing ?? waves.find(wave => wave.length > 0);
  if (!candidates) return null;

  const victim = lowest(candidates);
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
