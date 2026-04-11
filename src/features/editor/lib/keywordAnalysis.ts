import type { CVData, KeywordMatch, KeywordAnalysisResult, KeywordPlacement, Experience } from '@/src/shared/types';
import { extractNLPKeywords } from './atsHelpers';

// ─── Acronym detection ───

/**
 * Extract acronyms (2-5 uppercase letters) from text.
 * Handles slash-separated acronyms like "CI/CD".
 * Returns deduplicated array.
 */
export function extractAcronyms(text: string): string[] {
  if (!text?.trim()) return [];

  // Split on slashes first to handle "CI/CD" -> "CI", "CD"
  const normalized = text.replace(/\//g, ' ');
  const matches = normalized.match(/\b[A-Z]{2,5}\b/g);
  if (!matches) return [];

  return [...new Set(matches)];
}

// ─── Section text builders ───

interface SectionTextMap {
  summary: string;
  experience: string;
  skills: string;
  education: string;
}

/**
 * Build per-section text maps from CV data for keyword matching.
 * Each section's text is lowercased for case-insensitive comparison.
 */
function buildSectionTextMap(cvData: CVData): SectionTextMap {
  const summaryParts: string[] = [];
  if (cvData.personal_info.title) summaryParts.push(cvData.personal_info.title);
  if (cvData.personal_info.summary) summaryParts.push(cvData.personal_info.summary);

  const experienceParts: string[] = [];
  for (const exp of cvData.experience) {
    experienceParts.push(exp.position);
    if (exp.company) experienceParts.push(exp.company);
    if (exp.description) experienceParts.push(...exp.description);
  }

  const skillsParts: string[] = [];
  for (const skill of cvData.skills) {
    skillsParts.push(skill.category);
    skillsParts.push(...skill.items);
  }

  const educationParts: string[] = [];
  for (const edu of cvData.education) {
    educationParts.push(edu.school);
    educationParts.push(edu.degree);
    if (edu.field) educationParts.push(edu.field);
  }

  return {
    summary: summaryParts.join(' ').toLowerCase(),
    experience: experienceParts.join(' ').toLowerCase(),
    skills: skillsParts.join(' ').toLowerCase(),
    education: educationParts.join(' ').toLowerCase(),
  };
}

// ─── Word-boundary matching ───

/**
 * Test if a keyword is present in text using word-boundary regex.
 * Prevents false positives (e.g., "Java" != "JavaScript").
 * Case-insensitive.
 */
function matchKeyword(keyword: string, text: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\b|\\s)${escaped}(?:\\b|\\s|$)`, 'i');
  return re.test(text);
}

// ─── Fuzzy matching: normalize + stem + word-boundary ───

/**
 * Lowercase + strip diacritics (accents) + collapse whitespace.
 * Pure.
 */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining marks
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip common FR/EN suffixes for lightweight stemming.
 *
 * Scope (intentionally minimal — see Phase 12-02 trade-offs):
 *   - Plural normalization:  -s / -es / -x
 *   - EN present participle: -ing
 *   - FR profession suffix:  -eur / -eurs (less common but useful)
 *
 * NOT covered:
 *   - FR verb conjugations (gestion ↔ gère, piloter ↔ pilote)
 *   - Synonyms / abbreviations (React ↔ ReactJS, JS ↔ JavaScript)
 *   - Typos (Levenshtein distance)
 *
 * Preserves roots ≥ 3 chars after stripping to avoid over-reduction
 * (e.g., "les" stays "les", "iOS" stays "iOS").
 */
export function stripSimpleSuffixes(word: string): string {
  if (word.length < 4) return word;
  const suffixes = ['ings', 'ing', 'eurs', 'eur', 'es', 's', 'x'];
  for (const suf of suffixes) {
    if (word.length - suf.length >= 3 && word.endsWith(suf)) {
      return word.slice(0, -suf.length);
    }
  }
  return word;
}

/** Stem a normalized phrase token-by-token (skip tokens < 4 chars). */
function stemPhrase(s: string): string {
  return s
    .split(/\s+/)
    .map(t => (t.length >= 4 ? stripSimpleSuffixes(t) : t))
    .join(' ');
}

/**
 * Fuzzy keyword match — tolerates plural, accents, and common FR/EN suffixes.
 * Multi-word keywords use AND semantics: every token must appear (after stemming).
 */
export function matchKeywordFuzzy(keyword: string, text: string): boolean {
  // Fast path: exact match
  if (matchKeyword(keyword, text)) return true;

  const nk = normalizeForMatch(keyword);
  const nt = normalizeForMatch(text);
  if (nk.length === 0) return false;

  // Accent-stripped exact match
  if (matchKeyword(nk, nt)) return true;

  // Stem both sides and compare token-by-token
  const stemmedKeyword = stemPhrase(nk);
  const stemmedText = stemPhrase(nt);
  const tokens = stemmedKeyword.split(/\s+/).filter(t => t.length >= 3);
  if (tokens.length === 0) return false;

  for (const tok of tokens) {
    if (!matchKeyword(tok, stemmedText)) return false;
  }
  return true;
}

// ─── Main analysis ───

/**
 * Compute keyword analysis: compare JD keywords against CV content.
 * When aiKeywords are provided (from AI extraction), they replace NLP extraction.
 * Acronyms from the JD are still merged in as they're reliably detected.
 * Returns typed list of matched/missing keywords with section locations.
 * Pure function, no side effects.
 */
export function computeKeywordAnalysis(
  cvData: CVData,
  jobDescription: string,
  language: 'fr' | 'en',
  aiKeywords?: string[],
): KeywordAnalysisResult {
  if (!jobDescription?.trim()) {
    return { keywords: [], matchedCount: 0, totalCount: 0 };
  }

  // Use AI-extracted keywords when available, otherwise fall back to NLP
  const baseKeywords = aiKeywords && aiKeywords.length > 0
    ? aiKeywords
    : extractNLPKeywords(jobDescription, language);

  // Extract acronyms from job description (always reliable)
  const acronyms = extractAcronyms(jobDescription);

  // Merge and deduplicate (NLP keywords are lowercase, acronyms are uppercase)
  const seen = new Set<string>();
  const allKeywords: string[] = [];

  for (const kw of baseKeywords) {
    const lower = kw.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      allKeywords.push(kw);
    }
  }

  for (const acr of acronyms) {
    const lower = acr.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      allKeywords.push(acr);
    }
  }

  // Build per-section text maps
  const sections = buildSectionTextMap(cvData);
  const sectionKeys: (keyof SectionTextMap)[] = ['summary', 'experience', 'skills', 'education'];

  // Match each keyword against each section
  let matchedCount = 0;
  const keywords: KeywordMatch[] = allKeywords.map(kw => {
    const locations: string[] = [];

    for (const section of sectionKeys) {
      if (matchKeywordFuzzy(kw, sections[section])) {
        locations.push(section);
      }
    }

    const found = locations.length > 0;
    if (found) matchedCount++;

    const placement = found ? null : findBestPlacement(kw, cvData);

    return { keyword: kw, found, locations, placement };
  });

  return {
    keywords,
    matchedCount,
    totalCount: keywords.length,
  };
}

// ─── Keyword placement logic ───

/**
 * Find the best place in the CV to integrate a missing keyword.
 * Single-word keywords without context → skills.
 * Multi-word or keywords matching an experience context → that experience.
 */
function findBestPlacement(keyword: string, cvData: CVData): KeywordPlacement {
  const kwLower = keyword.toLowerCase();

  // Score each visible experience by relevance to this keyword
  let bestExp: { index: number; score: number; exp: Experience } | null = null;

  for (let i = 0; i < cvData.experience.length; i++) {
    const exp = cvData.experience[i];
    if ((exp.displayMode || 'normal') === 'hidden') continue;

    let score = 0;
    const fullText = [exp.position, exp.company, exp.intro || '', ...exp.description].join(' ').toLowerCase();

    for (const w of kwLower.split(/\s+/)) {
      if (w.length >= 3 && fullText.includes(w)) score += 3;
    }

    if (exp.current) score += 2;
    if (i === 0) score += 1;
    if (exp.description.length >= 2) score += 1;

    if (!bestExp || score > bestExp.score) {
      bestExp = { index: i, score, exp };
    }
  }

  // If keyword relates to an experience, suggest integrating there
  if (bestExp && bestExp.score >= 2) {
    return { type: 'experience', expIndex: bestExp.index, label: `${bestExp.exp.position} @ ${bestExp.exp.company}` };
  }

  // Otherwise → skills (most keywords from AI extraction are competencies)
  return { type: 'skill', label: 'Compétences' };
}
