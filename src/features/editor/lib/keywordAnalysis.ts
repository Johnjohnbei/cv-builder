import type { CVData, KeywordMatch, KeywordAnalysisResult } from '@/src/shared/types';
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

// ─── Main analysis ───

/**
 * Compute keyword analysis: compare JD keywords against CV content.
 * Returns typed list of matched/missing keywords with section locations.
 * Pure function, no side effects.
 */
export function computeKeywordAnalysis(
  cvData: CVData,
  jobDescription: string,
  language: 'fr' | 'en',
): KeywordAnalysisResult {
  if (!jobDescription?.trim()) {
    return { keywords: [], matchedCount: 0, totalCount: 0 };
  }

  // Extract NLP keywords from job description
  const nlpKeywords = extractNLPKeywords(jobDescription, language);

  // Extract acronyms from job description
  const acronyms = extractAcronyms(jobDescription);

  // Merge and deduplicate (NLP keywords are lowercase, acronyms are uppercase)
  const seen = new Set<string>();
  const allKeywords: string[] = [];

  for (const kw of nlpKeywords) {
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
      if (matchKeyword(kw, sections[section])) {
        locations.push(section);
      }
    }

    const found = locations.length > 0;
    if (found) matchedCount++;

    return { keyword: kw, found, locations };
  });

  return {
    keywords,
    matchedCount,
    totalCount: keywords.length,
  };
}
