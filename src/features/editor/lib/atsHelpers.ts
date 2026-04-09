import nlp from 'compromise';
import stats from 'compromise-stats';

nlp.plugin(stats);

import { extractKeywords } from './scoring';
import type { CVData } from '@/src/shared/types';

/** Internal sub-score result shape (mirrors SubScoreResult in scoring.ts). */
interface SubScoreResult {
  score: number;
  suggestions: string[];
}

// --- French stop words for bigram filtering ---

const FR_STOP_WORDS = new Set([
  'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'au', 'aux',
  'pour', 'dans', 'avec', 'sur', 'par', 'est', 'sont', 'qui', 'que',
  'vous', 'nous', 'ils', 'son', 'ses', 'ces', 'pas', 'plus', 'tout',
]);

/**
 * Extract keywords from text using NLP (English) or sliding-window (French).
 * Returns deduplicated array of lowercase keyword strings (>= 3 chars).
 * Pure function, no side effects.
 */
export function extractNLPKeywords(text: string, language: 'fr' | 'en'): string[] {
  if (!text?.trim()) return [];

  const lower = text.toLowerCase();

  if (language === 'en') {
    return extractEnglishKeywords(lower);
  }

  return extractFrenchKeywords(lower);
}

/** English NLP extraction via compromise: nouns + bigrams + unigrams. */
function extractEnglishKeywords(text: string): string[] {
  const doc = nlp(text);
  const nouns: string[] = doc.nouns().out('array');
  const bigrams: string[] = (doc as any).bigrams?.()
    ?.map((b: { normal: string }) => b.normal)
    ?.filter((b: string) => b.split(' ').length === 2) ?? [];
  const unigrams = extractKeywords(text);

  const all = [
    ...nouns.map((n: string) => n.toLowerCase()),
    ...bigrams,
    ...unigrams,
  ];

  return deduplicateAndFilter(all);
}

/** French fallback: unigrams + sliding-window bigrams (compromise is English-optimized). */
function extractFrenchKeywords(text: string): string[] {
  const unigrams = extractKeywords(text);
  const words = text
    .replace(/[^a-zà-ÿ0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !FR_STOP_WORDS.has(w));

  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }

  return deduplicateAndFilter([...unigrams, ...bigrams]);
}

/** Deduplicate and filter terms < 3 chars. */
function deduplicateAndFilter(terms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of terms) {
    const trimmed = t.trim().toLowerCase();
    if (trimmed.length >= 3 && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

/**
 * Compute TF-IDF weights for job terms against CV text.
 * Simplified 2-document corpus (job + cv). Returns Map<term, weight>.
 * Pure function, no side effects.
 */
export function computeTFIDF(jobTerms: string[], cvText: string, jobText: string): Map<string, number> {
  const weights = new Map<string, number>();
  const jobWords = jobText.toLowerCase().split(/\s+/);
  const totalWords = Math.max(1, jobWords.length);

  for (const term of jobTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|\\b|\\s)${escaped}(?:\\b|\\s|$)`, 'i');
    const tf = jobWords.filter(w => w.includes(term)).length / totalWords;
    const inCV = re.test(cvText) ? 1 : 0;
    const idf = Math.log((2 + 1) / (inCV + 1 + 1)) + 1;
    weights.set(term, tf * idf);
  }

  return weights;
}

// --- Relevance Scoring ---

/**
 * Build full-text representation of a CV for keyword matching.
 */
function buildCVText(cvData: CVData): string {
  const parts: string[] = [];
  if (cvData.personal_info.title) parts.push(cvData.personal_info.title);
  if (cvData.personal_info.summary) parts.push(cvData.personal_info.summary);
  for (const exp of cvData.experience) {
    parts.push(exp.position);
    if (exp.description) parts.push(...exp.description);
  }
  for (const skill of cvData.skills) {
    parts.push(...skill.items);
  }
  return parts.join(' ').toLowerCase();
}

/**
 * Score the relevance of a CV to a job description (0-100).
 * Uses NLP keyword extraction + TF-IDF weighting.
 * Pure function, no side effects (per D-03).
 */
export function scoreRelevance(cvData: CVData, jobDescription: string, language: 'fr' | 'en'): SubScoreResult {
  const keywords = extractNLPKeywords(jobDescription, language);
  if (keywords.length === 0) {
    return { score: 0, suggestions: ['Job description has no extractable keywords'] };
  }

  const cvText = buildCVText(cvData);
  const weights = computeTFIDF(keywords, cvText, jobDescription.toLowerCase());

  let matchedWeight = 0;
  let totalWeight = 0;
  const missing: Array<{ term: string; weight: number }> = [];

  for (const [term, weight] of weights) {
    totalWeight += weight;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|\\b|\\s)${escaped}(?:\\b|\\s|$)`, 'i');
    if (re.test(cvText)) {
      matchedWeight += weight;
    } else {
      missing.push({ term, weight });
    }
  }

  const score = totalWeight > 0 ? Math.round(Math.max(0, Math.min(100, (matchedWeight / totalWeight) * 100))) : 0;

  // Top 5 missing high-weight keywords as suggestions
  const suggestions = missing
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map(m => `Consider adding keyword: ${m.term}`);

  return { score, suggestions };
}
