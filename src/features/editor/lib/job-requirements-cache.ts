import { REQUIREMENT_IMPORTANCES, REQUIREMENT_KINDS, type GenerationRecord, type JobRequirement } from '@/src/shared/types';
import { readStoredJSON, writeStoredText } from '@/src/shared/lib/storage';
import { ATS_POLICY } from './ats-rules';

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
 * The key changes with what an analysis carries: the former keyword cache
 * ('ai_keywords_cache') and the lists analyzed before each requirement named
 * itself in both languages ('job_requirements_cache') are never read.
 */
export const REQUIREMENTS_CACHE_KEY = `job_requirements_cache_${ATS_POLICY.extractionVersion}`;
const MAX_OFFERS = 5;

interface CachedRequirements {
  jobDescription: string;
  requirements: JobRequirement[];
  version: string;
  analyzedAt: number;
}

/**
 * Two offers that read the same are the same offer. Whitespace only: a space
 * added at the end of the field, a line break pasted twice, a tab from a
 * website relaunched the analysis, which is a paid AI call, for a text saying
 * exactly the same thing. Anything else is a different offer and is analyzed
 * again, as it must be.
 */
function normalize(jd: string): string {
  return jd.replace(/\s+/g, ' ').trim();
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

/**
 * Whether nothing more is expected for the offer on screen, so a pass reading
 * the requirements (the fit to pages) can run. A hung analysis cannot hold it
 * forever: the Convex action ends at its time limit and the status turns failed.
 */
export function isRequirementsSettled(status: RequirementsStatus): boolean {
  return status !== 'loading' && status !== 'pending';
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
    && (REQUIREMENT_IMPORTANCES as readonly unknown[]).includes(r.importance)
    && (r.minYears === undefined || (typeof r.minYears === 'number' && Number.isFinite(r.minYears) && r.minYears > 0))
    && (r.minLevel === undefined || ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(r.minLevel))
    && (r.experienceScope === undefined || (Array.isArray(r.experienceScope) && r.experienceScope.length <= 8 && r.experienceScope.every(term => typeof term === 'string' && term.length > 0 && term.length <= 100)))
    && (r.needsVerification === undefined || typeof r.needsVerification === 'boolean');
}

/** Optional metadata is untrusted storage too. A corrupt snapshot never breaks an older CV. */
export function generationOf(value: unknown): GenerationRecord | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const g = value as GenerationRecord;
  const strings = [g.id, g.createdAt, g.rulesVersion, g.extractionVersion, g.promptVersion, g.model, g.offer];
  if (!strings.every(s => typeof s === 'string') || !Number.isFinite(Date.parse(g.createdAt)) || g.offer.length > 20_000) return undefined;
  if (!Number.isFinite(g.durationMs) || g.durationMs < 0 || typeof g.extractionAtLimit !== 'boolean') return undefined;
  if (g.initialScore !== null && (!Number.isFinite(g.initialScore) || g.initialScore < 0 || g.initialScore > 100)) return undefined;
  if (!Array.isArray(g.requirements) || g.requirements.length > ATS_POLICY.maxRequirements || !g.requirements.every(isRequirement)) return undefined;
  if (g.completion !== undefined && (!g.completion || typeof g.completion !== 'object' || !Number.isInteger(g.completion.skillsCovered) || !Number.isInteger(g.completion.skillsTotal)
    || g.completion.skillsCovered < 0 || g.completion.skillsTotal < g.completion.skillsCovered || g.completion.skillsTotal > ATS_POLICY.maxRequirements
    || !Array.isArray(g.completion.qualificationGapIds) || g.completion.qualificationGapIds.length > ATS_POLICY.maxRequirements
    || !g.completion.qualificationGapIds.every(id => typeof id === 'string'))) return undefined;
  if (g.relatedExperience !== undefined && (!Array.isArray(g.relatedExperience) || g.relatedExperience.length > ATS_POLICY.maxRequirements
    || !g.relatedExperience.every(e => e && typeof e.requirementId === 'string' && Number.isInteger(e.experienceIndex) && e.experienceIndex >= 0
      && typeof e.sourceQuote === 'string' && e.sourceQuote.length <= 1200 && typeof e.adaptedQuote === 'string' && e.adaptedQuote.length <= 1200))) return undefined;
  if (![g.sourceRequirementIds, g.addedRequirementIds].every(ids => Array.isArray(ids) && ids.length <= ATS_POLICY.maxRequirements && ids.every(id => typeof id === 'string'))) return undefined;
  if (g.objectiveRequirementIds !== undefined && (!Array.isArray(g.objectiveRequirementIds) || g.objectiveRequirementIds.length > ATS_POLICY.maxRequirements || !g.objectiveRequirementIds.every(id => typeof id === 'string'))) return undefined;
  if (g.scopedYears !== undefined && (!Array.isArray(g.scopedYears) || !g.scopedYears.every(item => item && typeof item.company === 'string' && typeof item.start_date === 'string' && (item.end_date === undefined || typeof item.end_date === 'string') && typeof item.current === 'boolean' && typeof item.sourceText === 'string' && item.sourceText.length <= 60_000))) return undefined;
  return g;
}

function readEntries(): CachedRequirements[] {
  const parsed = readStoredJSON<unknown>(REQUIREMENTS_CACHE_KEY, []);
  return Array.isArray(parsed)
    ? parsed.filter((e): e is CachedRequirements => typeof e?.jobDescription === 'string' && Array.isArray(e.requirements))
    : [];
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
  const valid = hit?.version === ATS_POLICY.extractionVersion && Number.isFinite(hit.analyzedAt)
    && hit.analyzedAt <= Date.now() && Date.now() - hit.analyzedAt < ATS_POLICY.cacheMaxAgeMs
    ? hit.requirements.filter(isRequirement) : [];
  return valid.length > 0 ? valid : null;
}

// ─── One analysis per offer ───
// The one owner of "extract the requirements of an offer": a single request per
// offer and access code at a time in the tab, cached once answered. The
// StrictMode remount and a return to an offer still being analyzed each sent a
// second request.

type RequirementsAnswer = Promise<{ requirements: unknown }>;
type ExtractRequirements = (args: { jobDescription: string; accessCode?: string }) => RequirementsAnswer;

/** Module-wide: the editor's and the dashboard's hooks share the analyses running */
const inflight = new Map<string, Promise<JobRequirement[]>>();
const inflightKey = (offer: string, accessCode?: string) => JSON.stringify([normalize(offer), accessCode ?? '']);

/** Cached or already running, never a new (billed) request: undefined otherwise */
function pendingRequirements(offer: string, accessCode?: string): Promise<JobRequirement[]> | undefined {
  const cached = readCachedRequirements(offer);
  return cached ? Promise.resolve(cached) : inflight.get(inflightKey(offer, accessCode));
}

/** `answer` read as the requirements of `offer`: cached once valid, the running analysis while none other runs */
function track(offer: string, accessCode: string | undefined, answer: RequirementsAnswer): Promise<JobRequirement[]> {
  const request = answer.then(data => {
    const requirements = Array.isArray(data.requirements) ? data.requirements.filter(isRequirement) : [];
    if (requirements.length === 0) throw new Error('No requirement in the answer');
    // Cached even when superseded or unmounted: the call is paid, and the offer may come back
    writeCachedRequirements(offer, requirements);
    return requirements;
  });
  const key = inflightKey(offer, accessCode);
  if (!inflight.has(key)) {
    inflight.set(key, request);
    // Settled: the cache answers from now on, and a failure is asked again at the
    // next request. Registered first, so the entry is gone before any waiter reacts.
    const forget = () => inflight.delete(key);
    request.then(forget, forget);
  }
  return request;
}

/** Cached, already running, or a new request for `offer` */
export function requestRequirements(offer: string, accessCode: string | undefined, extract: ExtractRequirements): Promise<JobRequirement[]> {
  return pendingRequirements(offer, accessCode) ?? track(offer, accessCode, extract({ jobDescription: offer, accessCode }));
}

export function writeCachedRequirements(jobDescription: string, requirements: JobRequirement[]): void {
  const jd = normalize(jobDescription);
  if (!jd) return;
  const entry: CachedRequirements = { jobDescription: jd, requirements, version: ATS_POLICY.extractionVersion, analyzedAt: Date.now() };
  answeredInTab = mostRecentOffers([entry, ...answeredInTab]);
  // Refused by a full quota or by private mode: the in-memory copy still
  // answers for this tab, which is what writeStoredText's false return says
  writeStoredText(REQUIREMENTS_CACHE_KEY, JSON.stringify(mostRecentOffers([entry, ...readEntries()])));
}
