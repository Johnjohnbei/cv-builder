/**
 * PDF text extractability validation.
 *
 * Compares rendered DOM text against expected CV content to detect
 * cases where ATS parsers would fail to extract meaningful text.
 */
import type { CVData } from '@/src/shared/types';

// ─── Types ───

export interface ValidationResult {
  valid: boolean;
  ratio: number;
  warning?: string;
}

// ─── Constants ───

const EXTRACTABILITY_THRESHOLD = 0.6;

// ─── Public API ───

/**
 * Build a plain-text representation of what the CV should contain.
 * Skips hidden experiences and hidden skill categories.
 */
export function extractExpectedText(cvData: CVData): string {
  const parts: string[] = [];

  // Personal info
  const pi = cvData.personal_info;
  if (pi.name) parts.push(pi.name);
  if (pi.title) parts.push(pi.title);
  if (pi.email) parts.push(pi.email);
  if (pi.phone) parts.push(pi.phone);
  if (pi.location) parts.push(pi.location);
  if (pi.summary) parts.push(pi.summary);

  // Experiences (skip hidden)
  for (const exp of cvData.experience) {
    if (exp.displayMode === 'hidden') continue;
    parts.push(exp.company);
    parts.push(exp.position);
    if (exp.intro) parts.push(exp.intro);
    for (const bullet of exp.description) {
      parts.push(bullet);
    }
  }

  // Education
  for (const edu of cvData.education) {
    parts.push(edu.school);
    parts.push(edu.degree);
    if (edu.field) parts.push(edu.field);
  }

  // Skills (skip hidden)
  for (const cat of cvData.skills) {
    if (cat.displayMode === 'hidden') continue;
    for (const item of cat.items) {
      parts.push(item);
    }
  }

  // Languages
  for (const lang of cvData.languages) {
    parts.push(lang.name);
  }

  return parts.filter(Boolean).join(' ');
}

/**
 * Validate that rendered text contains a sufficient ratio of expected content.
 *
 * @param renderedText - innerText extracted from the rendered DOM
 * @param expectedText - text built from CVData via extractExpectedText
 * @returns ValidationResult with valid flag, ratio, and optional warning
 */
export function validateCVTextExtractability(
  renderedText: string,
  expectedText: string,
): ValidationResult {
  const expectedTokens = tokenize(expectedText);

  // Nothing to validate
  if (expectedTokens.length === 0) {
    return { valid: true, ratio: 1 };
  }

  const renderedTokens = tokenize(renderedText);

  // No text extracted at all
  if (renderedTokens.length === 0) {
    return {
      valid: false,
      ratio: 0,
      warning:
        'Le PDF exporte ne contient aucun texte extractible. Les systemes ATS ne pourront pas lire votre CV.',
    };
  }

  const ratio = renderedTokens.length / expectedTokens.length;

  if (ratio >= EXTRACTABILITY_THRESHOLD) {
    return { valid: true, ratio };
  }

  const percent = Math.round(ratio * 100);
  return {
    valid: false,
    ratio,
    warning: `Le PDF exporte contient peu de texte extractible (${percent}%). Les systemes ATS pourraient avoir du mal a lire votre CV.`,
  };
}

// ─── Helpers ───

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}
