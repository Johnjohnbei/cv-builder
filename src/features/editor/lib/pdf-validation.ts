/**
 * PDF text extractability validation.
 *
 * Compares rendered DOM text against expected CV content to detect
 * cases where ATS parsers would fail to extract meaningful text.
 */
import type { CVData, DesignSettings } from '@/src/shared/types';
import { normalizeForMatch } from '@/src/shared/lib/text';
import { cvSections } from './keyword-analysis';

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
 * Plain text of what the rendered CV should contain: the contact line, then
 * every part as the ATS score reads it (display modes, Design sections and
 * inline markdown applied). One owner of "what the CV prints" for the score and
 * for this check. Pass the masked CV when the export is anonymized.
 */
export function extractExpectedText(cvData: CVData, design?: Pick<DesignSettings, 'includedSections'>): string {
  const pi = cvData.personal_info;
  const sections = cvSections(cvData, 'rendered', design);
  return [pi.name, pi.email, pi.phone, pi.location, ...Object.values(sections).flat()]
    .filter(Boolean)
    .join(' ');
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
        'Le PDF exporté ne contient aucun texte extractible. Les systèmes ATS ne pourront pas lire votre CV.',
    };
  }

  // Real coverage: share of expected tokens actually present in the render.
  // A pure count ratio scored 100% on wrong-language or garbage output, and
  // the render's extra tokens (dates, section titles) pushed it above 1.
  const renderedSet = new Set(renderedTokens);
  const expectedUnique = [...new Set(expectedTokens)];
  const matched = expectedUnique.filter(t => renderedSet.has(t)).length;
  const ratio = matched / expectedUnique.length;

  if (ratio >= EXTRACTABILITY_THRESHOLD) {
    return { valid: true, ratio };
  }

  const percent = Math.round(ratio * 100);
  return {
    valid: false,
    ratio,
    warning: `Le PDF exporté contient peu de texte extractible (${percent} %). Les systèmes ATS pourraient avoir du mal à lire votre CV.`,
  };
}

// ─── Helpers ───

/** Words, normalized: the render prints "(PME · SaaS)" and "Master, Design" where the data holds the bare words */
function tokenize(text: string): string[] {
  return normalizeForMatch(text).split(/[^\p{L}\p{N}@+#]+/u).filter(Boolean);
}
