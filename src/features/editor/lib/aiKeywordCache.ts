/**
 * Local cache of the AI-extracted job keywords, keyed by the job description.
 *
 * Without it, every editor load with a job description spends one LLM call
 * re-deriving keywords that never changed. Cheap to store (a short string
 * array per offer), and the job description is the only input.
 *
 * It keeps the last few offers, not one: with a single entry, a response for
 * an offer committed a moment before another one was dropped or evicted, and
 * that offer was billed again when it came back.
 */
const KEY = 'ai_keywords_cache';
const MAX_OFFERS = 5;

interface CachedKeywords {
  jobDescription: string;
  keywords: string[];
}

function normalize(jd: string): string {
  return jd.trim();
}

/** Keywords together with the offer they were extracted from */
export interface AnalyzedOffer {
  offer: string;
  keywords: string[];
}

const NO_KEYWORDS: string[] = [];

/** The keywords when `liveOffer` is the offer they describe, none otherwise. */
export function keywordsForOffer(liveOffer: string, analyzed: AnalyzedOffer): string[] {
  const jd = normalize(liveOffer);
  return jd && jd === normalize(analyzed.offer) ? analyzed.keywords : NO_KEYWORDS;
}

function readEntries(): CachedKeywords[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // A single object is the format written before several offers were kept
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.filter((e): e is CachedKeywords =>
      typeof e?.jobDescription === 'string' && Array.isArray(e.keywords));
  } catch {
    return [];
  }
}

/**
 * Offers answered in this tab, kept in memory as well. When storage refuses
 * the write (quota full with a base64 photo, private mode), every commit of
 * the same offer used to find nothing and pay for the extraction again.
 */
let answeredInTab: CachedKeywords[] = [];

/** First entry per offer, most recent first, capped */
function mostRecentOffers(entries: CachedKeywords[]): CachedKeywords[] {
  const seen = new Set<string>();
  return entries.filter(e => {
    const jd = normalize(e.jobDescription);
    if (seen.has(jd)) return false;
    seen.add(jd);
    return true;
  }).slice(0, MAX_OFFERS);
}

/** Cached keywords for this exact job description, or null. */
export function readCachedKeywords(jobDescription: string): string[] | null {
  const jd = normalize(jobDescription);
  if (!jd) return null;
  const hit = [...answeredInTab, ...readEntries()].find(e => normalize(e.jobDescription) === jd);
  return hit ? hit.keywords.filter((k): k is string => typeof k === 'string') : null;
}

export function writeCachedKeywords(jobDescription: string, keywords: string[]): void {
  const jd = normalize(jobDescription);
  if (!jd) return;
  answeredInTab = mostRecentOffers([{ jobDescription: jd, keywords }, ...answeredInTab]);
  try {
    localStorage.setItem(KEY, JSON.stringify(mostRecentOffers([{ jobDescription: jd, keywords }, ...readEntries()])));
  } catch {
    // Quota or private mode: the in-memory copy still answers for this tab
  }
}
