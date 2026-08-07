/**
 * Local cache of the AI-extracted job keywords, keyed by the job description.
 *
 * Without it, every editor load with a job description spends one LLM call
 * re-deriving keywords that never changed. Cheap to store (a short string
 * array), and the job description is the only input, so a plain key/value
 * pair is enough.
 */
const KEY = 'ai_keywords_cache';

interface CachedKeywords {
  jobDescription: string;
  keywords: string[];
}

function normalize(jd: string): string {
  return jd.trim();
}

/** Cached keywords for this exact job description, or null. */
export function readCachedKeywords(jobDescription: string): string[] | null {
  const jd = normalize(jobDescription);
  if (!jd) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedKeywords>;
    if (typeof parsed?.jobDescription !== 'string' || !Array.isArray(parsed.keywords)) return null;
    if (normalize(parsed.jobDescription) !== jd) return null;
    return parsed.keywords.filter((k): k is string => typeof k === 'string');
  } catch {
    return null;
  }
}

export function writeCachedKeywords(jobDescription: string, keywords: string[]): void {
  const jd = normalize(jobDescription);
  if (!jd) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ jobDescription: jd, keywords }));
  } catch {
    // Quota or private mode: the cache is an optimization, never a requirement
  }
}
