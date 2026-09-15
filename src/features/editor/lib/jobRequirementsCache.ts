import { REQUIREMENT_IMPORTANCES, REQUIREMENT_KINDS, type JobRequirement } from '@/src/shared/types';

/**
 * Local cache of the AI-extracted job requirements, keyed by the job description.
 *
 * Without it, every editor load with a job description spends one LLM call
 * re-deriving requirements that never changed, and the same offer could come
 * back with a slightly different list. The job description is the only input.
 *
 * It keeps the last few offers, not one: with a single entry, a response for
 * an offer committed a moment before another one was dropped or evicted, and
 * that offer was billed again when it came back.
 *
 * The key changed with the format: entries of the former keyword cache
 * ('ai_keywords_cache', plain strings) are never read.
 */
const KEY = 'job_requirements_cache';
const MAX_OFFERS = 5;

interface CachedRequirements {
  jobDescription: string;
  requirements: JobRequirement[];
}

function normalize(jd: string): string {
  return jd.trim();
}

/** Requirements together with the offer they were extracted from */
export interface AnalyzedOffer {
  offer: string;
  requirements: JobRequirement[];
}

const NO_REQUIREMENTS: JobRequirement[] = [];

/**
 * idle: no offer. pending: the offer on screen is not committed yet (nothing
 * runs until the field loses focus). loading: the committed offer is being
 * analyzed. ready: requirements known. failed: the analysis of this offer failed.
 */
export type RequirementsStatus = 'idle' | 'pending' | 'loading' | 'ready' | 'failed';

export function requirementsStatus(state: {
  liveOffer: string;
  committedOffer: string;
  requirements: JobRequirement[];
  failedOffer: string;
}): RequirementsStatus {
  const live = state.liveOffer.trim();
  if (!live) return 'idle';
  if (state.requirements.length > 0) return 'ready';
  if (live !== state.committedOffer.trim()) return 'pending';
  return state.failedOffer.trim() === live ? 'failed' : 'loading';
}

/** The requirements when `liveOffer` is the offer they describe, none otherwise. */
export function requirementsForOffer(liveOffer: string, analyzed: AnalyzedOffer): JobRequirement[] {
  const jd = normalize(liveOffer);
  return jd && jd === normalize(analyzed.offer) ? analyzed.requirements : NO_REQUIREMENTS;
}

/** Storage is outside the app's control: every field the score reads is checked */
function isRequirement(value: unknown): value is JobRequirement {
  const r = value as Partial<JobRequirement> | null;
  return typeof r?.id === 'string'
    && typeof r.label === 'string'
    && typeof r.quote === 'string'
    && Array.isArray(r.variants) && r.variants.every(v => typeof v === 'string')
    && (REQUIREMENT_KINDS as readonly unknown[]).includes(r.kind)
    && (REQUIREMENT_IMPORTANCES as readonly unknown[]).includes(r.importance);
}

function readEntries(): CachedRequirements[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((e): e is CachedRequirements => typeof e?.jobDescription === 'string' && Array.isArray(e.requirements))
      : [];
  } catch {
    return [];
  }
}

/**
 * Offers answered in this tab, kept in memory as well. When storage refuses
 * the write (quota full with a base64 photo, private mode), every commit of
 * the same offer used to find nothing and pay for the extraction again.
 */
let answeredInTab: CachedRequirements[] = [];

/** First entry per offer, most recent first, capped */
function mostRecentOffers(entries: CachedRequirements[]): CachedRequirements[] {
  const seen = new Set<string>();
  return entries.filter(e => {
    const jd = normalize(e.jobDescription);
    if (seen.has(jd)) return false;
    seen.add(jd);
    return true;
  }).slice(0, MAX_OFFERS);
}

/**
 * Cached requirements for this exact job description, or null. An entry with
 * no valid requirement left answers null too, so the offer is analyzed again
 * instead of staying pinned to an empty list.
 */
export function readCachedRequirements(jobDescription: string): JobRequirement[] | null {
  const jd = normalize(jobDescription);
  if (!jd) return null;
  const hit = [...answeredInTab, ...readEntries()].find(e => normalize(e.jobDescription) === jd);
  const valid = hit?.requirements.filter(isRequirement) ?? [];
  return valid.length > 0 ? valid : null;
}

export function writeCachedRequirements(jobDescription: string, requirements: JobRequirement[]): void {
  const jd = normalize(jobDescription);
  if (!jd) return;
  answeredInTab = mostRecentOffers([{ jobDescription: jd, requirements }, ...answeredInTab]);
  try {
    localStorage.setItem(KEY, JSON.stringify(mostRecentOffers([{ jobDescription: jd, requirements }, ...readEntries()])));
  } catch {
    // Quota or private mode: the in-memory copy still answers for this tab
  }
}
