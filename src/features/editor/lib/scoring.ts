import type { Experience, CVData, DesignSettings, ATSScoreResult } from '@/src/shared/types';
import { TEMPLATE_ATS_COMPAT, ATS_SAFE_FONTS, WEAK_VERBS } from './atsRules';
import { getCVLanguage } from '@/src/lib/languageDetection';
import { extractNLPKeywords as _extractNLPKeywords, scoreRelevance as _scoreRelevance } from './atsHelpers';
import { STOP_WORDS } from '@/src/shared/lib/stopWords';

// --- Keyword Extraction ---

/**
 * Extract keywords from a job description for scoring.
 * Pure text processing, no AI.
 */
export function extractKeywords(jobDescription: string): string[] {
  if (!jobDescription) return [];
  return [...new Set(
    jobDescription
      .toLowerCase()
      .replace(/[^a-zà-ÿ0-9\s+#.]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3)
      // Filter out ultra-common French/English stop words
      .filter(w => !STOP_WORDS.has(w))
  )].slice(0, 60); // cap: scoreExperience runs one regex per keyword per render
}

// --- Relevance Scoring ---

/**
 * Display bands for the per-experience relevance badge.
 *
 * Deliberately far lower than they look, and measured rather than guessed. The
 * score answers "what share of the offer's requirements does THIS experience
 * evidence", and no single experience covers a whole posting. Across two real
 * offers, run through the real keyword pipeline:
 *
 *   - a perfectly on-target experience lands at 38-47 %
 *     (38 % against the 21-term AI list, 47 % against the 40-term NLP fallback:
 *      the AI terms are multi-word and harder to match literally)
 *   - an off-target experience lands at 9-15 %, carried only by its recency
 *
 * With the usual 70/40 bands the best experience for the job rendered red. A
 * first attempt at 55 was calibrated on a hand-picked keyword list, which is the
 * same selection bias that produced a wrong diagnosis on the provider chain the
 * day before — bands belong on measured distributions, not on convenient ones.
 *
 * This calibrates the DISPLAY only. No factor is injected into the score, which
 * stays verifiable by counting matches against the keyword list. Keep it so.
 */
export const RELEVANCE_BAND_HIGH = 35;
export const RELEVANCE_BAND_MEDIUM = 18;

export type RelevanceBand = 'high' | 'medium' | 'low';

/** Which display band a per-experience relevance score falls into. */
export function relevanceBand(score: number): RelevanceBand {
  if (score >= RELEVANCE_BAND_HIGH) return 'high';
  if (score >= RELEVANCE_BAND_MEDIUM) return 'medium';
  return 'low';
}

/** Weight of fit-to-position once an offer is known. Recency is the remainder. */
const RELEVANCE_WEIGHT = 0.85;

/**
 * How well an experience fits the position (0-100).
 *
 * With an offer, fit dominates and recency is only a tiebreaker. The previous
 * split (relevance 0.50 / recency 0.35 / duration 0.15) let recency carry an
 * off-target experience almost as high as a perfect match: measured on a "Lead
 * Design System" offer, a Head of Marketing role with 0 % relevance scored
 * 46 % against 53 % for the exactly-matching role. Seven points apart, for two
 * experiences that have nothing in common. At 0.85 the same pair splits 15 %
 * against ~58 %, which is the ordering the user reads on the badge and the one
 * the fit pass must act on.
 *
 * Recency keeps its 15 % on purpose: between two comparably relevant roles, the
 * recent one belongs first, which is what a recruiter expects.
 *
 * Without an offer there is no fit to measure, so recency and duration are all
 * that is left to rank on.
 */
export function scoreExperience(exp: Experience, jobKeywords: string[]): number {
  const recency = computeRecency(exp);
  if (jobKeywords.length === 0) {
    return Math.round(recency * 0.6 + computeDuration(exp) * 0.4);
  }
  const relevance = computeKeywordMatch(exp, jobKeywords);
  return Math.round(relevance * RELEVANCE_WEIGHT + recency * (1 - RELEVANCE_WEIGHT));
}

/**
 * Match experience text against keywords using word-boundary regex.
 * Handles special characters (C++, C#, .NET, Node.js) via regex escaping.
 */
export function computeKeywordMatch(exp: Experience, keywords: string[]): number {
  const text = [exp.position, exp.company, ...(exp.description || [])].join(' ').toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    // Escape regex special chars (handles C++, C#, .NET, Node.js)
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Word-boundary matching: \b for ASCII, lookaround for accented chars
    const re = new RegExp(`(?:^|\\b|\\s)${escaped}(?:\\b|\\s|$)`, 'i');
    if (re.test(text)) hits++;
  }
  return Math.min(100, Math.round((hits / Math.max(1, keywords.length)) * 100));
}

/** Score based on how recent the experience is (0-100). */
export function computeRecency(exp: Experience): number {
  const now = new Date().getFullYear();
  if (exp.current) return 100;
  const year = parseYear(exp.end_date);
  if (!year) return 30;
  const ago = now - year;
  if (ago <= 1) return 95;
  if (ago <= 3) return 80;
  if (ago <= 5) return 60;
  if (ago <= 10) return 40;
  return 20;
}

/** Score based on experience duration (0-100). */
export function computeDuration(exp: Experience): number {
  const start = parseYear(exp.start_date);
  const end = exp.current ? new Date().getFullYear() : parseYear(exp.end_date);
  if (!start || !end) return 30;
  const years = end - start;
  if (years >= 5) return 90;
  if (years >= 3) return 70;
  if (years >= 1) return 50;
  return 30;
}

function parseYear(d?: string): number | null {
  if (!d) return null;
  const m = d.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

// --- ATS Format Scoring ---

/** Internal sub-score result type. */
export interface SubScoreResult {
  score: number;
  suggestions: string[];
}

/** Map design fontFamily values to actual font names. */
const FONT_FAMILY_MAP: Record<string, string> = {
  sans: 'Arial',
  serif: 'Georgia',
  mono: 'Courier New',
  playfair: 'Playfair Display',
  outfit: 'Outfit',
};

/** Regex for metrics in bullet points: numbers, %, $, euro. */
const METRICS_REGEX = /\d+%|\$[\d,.]+|€[\d,.]+|\d{2,}/;

/** Check if email is present and valid. */
function hasEmail(email?: string): boolean {
  return !!email && email.includes('@');
}

/** Check if phone has 7+ digits. */
function hasPhone(phone?: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7;
}

/** Check if font is ATS-safe. */
function isFontATSSafe(fontFamily: string): boolean {
  const fontName = FONT_FAMILY_MAP[fontFamily] ?? fontFamily;
  return (ATS_SAFE_FONTS as readonly string[]).includes(fontName);
}

/** Check if a bullet contains quantifiable metrics. */
function bulletHasMetrics(bullet: string): boolean {
  return METRICS_REGEX.test(bullet);
}

/** Check if a bullet starts with a weak verb. */
function bulletStartsWithWeakVerb(bullet: string, language: 'fr' | 'en'): boolean {
  const lower = bullet.toLowerCase().trim();
  return WEAK_VERBS[language].weak.some(v => lower.startsWith(v));
}

/** Check if bullet word count is in the 5-30 range. */
function isBulletLengthOK(bullet: string): boolean {
  const words = bullet.trim().split(/\s+/).length;
  return words >= 5 && words <= 30;
}

/**
 * Score the format/structure of a CV for ATS compatibility (0-100).
 * Checks: template compat, section names, font safety, contact info.
 * Pure function, no side effects.
 */
export function scoreFormat(cvData: CVData, design: DesignSettings, language: 'fr' | 'en'): SubScoreResult {
  const suggestions: string[] = [];
  let score = 0;

  // Template ATS compat (25 pts)
  const compat = TEMPLATE_ATS_COMPAT[design.template];
  if (compat === 'full') {
    score += 25;
  } else if (compat === 'limited') {
    score += 10;
    suggestions.push('Utilisez un template mono-colonne compatible ATS');
  } else {
    suggestions.push('Template inconnu : compatibilité ATS incertaine');
  }

  // Sections (25 pts): a section counts when it is shown AND has content.
  // Contact is scored below. Checked against the toggle list alone, "contact"
  // never matched the "personal" key the app stores, so every CV lost points
  // and read "Sections manquantes : contact" in raw English keys.
  const shows = (section: string) => !design.includedSections || design.includedSections.includes(section);
  const sections: [label: string, present: boolean][] = [
    ['Profil', shows('summary') && Boolean(cvData.personal_info.summary?.trim())],
    ['Expérience', shows('experience') && cvData.experience.length > 0],
    ['Formation', shows('education') && cvData.education.length > 0],
    ['Compétences', shows('skills') && cvData.skills.length > 0],
  ];
  const missing = sections.filter(([, present]) => !present).map(([label]) => label);
  score += Math.round(((sections.length - missing.length) / sections.length) * 25);
  if (missing.length > 0) {
    suggestions.push(`Sections manquantes : ${missing.join(', ')}`);
  }

  // Font safety (25 pts)
  if (isFontATSSafe(design.fontFamily)) {
    score += 25;
  } else {
    suggestions.push('Utilisez une police compatible ATS (Arial, Calibri, Helvetica, Times New Roman, Georgia)');
  }

  // Contact info (25 pts)
  if (hasEmail(cvData.personal_info.email)) {
    score += 12.5;
  } else {
    suggestions.push('Ajoutez une adresse email valide');
  }
  if (hasPhone(cvData.personal_info.phone)) {
    score += 12.5;
  } else {
    suggestions.push('Ajoutez un numéro de téléphone');
  }

  // SVG icon check placeholder per D-05: assume no icons = full points (0 pts allocated)

  return { score: Math.round(Math.max(0, Math.min(100, score))), suggestions };
}

// --- ATS Content Scoring ---

/**
 * Score the content quality of a CV for ATS (0-100).
 * Checks: metrics in bullets, strong verbs, bullet length, essential sections, skills.
 * Pure function, no side effects.
 */
export function scoreContent(cvData: CVData, language: 'fr' | 'en'): SubScoreResult {
  const suggestions: string[] = [];

  // Collect all bullet points
  const bullets = cvData.experience.flatMap(exp => exp.description ?? []);
  if (bullets.length === 0) {
    return { score: 0, suggestions: ['Ajoutez des bullet points d\'expérience'] };
  }

  let score = 0;

  // Metrics check (25 pts): % of bullets with metrics, target >= 50%
  const metricsCount = bullets.filter(bulletHasMetrics).length;
  const metricsRatio = metricsCount / bullets.length;
  const metricsScore = Math.round(Math.min(metricsRatio / 0.5, 1) * 25);
  score += metricsScore;
  if (metricsRatio < 0.5) {
    suggestions.push('Ajoutez des métriques chiffrées (nombres, %, €) à davantage de bullet points');
  }

  // Weak verb check (25 pts): % of bullets NOT starting with weak verb
  const weakCount = bullets.filter(b => bulletStartsWithWeakVerb(b, language)).length;
  const strongRatio = (bullets.length - weakCount) / bullets.length;
  score += Math.round(strongRatio * 25);
  if (weakCount > 0) {
    suggestions.push('Remplacez les verbes faibles (aidé, travaillé, assisté) par des verbes d\'action forts');
  }

  // Bullet length check (20 pts): % of bullets with 5-30 words
  const goodLengthCount = bullets.filter(isBulletLengthOK).length;
  score += Math.round((goodLengthCount / bullets.length) * 20);
  if (goodLengthCount < bullets.length) {
    suggestions.push('Gardez les bullet points entre 5 et 30 mots');
  }

  // Essential sections check (15 pts): infer from data
  let sectionPoints = 0;
  if (cvData.experience.length > 0) sectionPoints += 3.75;
  if (cvData.education.length > 0) sectionPoints += 3.75;
  if (cvData.skills.length > 0) sectionPoints += 3.75;
  if (cvData.personal_info.summary) sectionPoints += 3.75;
  score += Math.round(sectionPoints);
  if (sectionPoints < 15) {
    suggestions.push('Incluez toutes les sections essentielles : expérience, formation, compétences, résumé');
  }

  // Skills not empty (15 pts)
  if (cvData.skills.length > 0 && cvData.skills.some(s => s.items.length > 0)) {
    score += 15;
  } else {
    suggestions.push('Ajoutez des compétences pour améliorer la correspondance ATS');
  }

  return { score: Math.max(0, Math.min(100, score)), suggestions };
}

// --- NLP re-exports ---

export { _extractNLPKeywords as extractNLPKeywords };
export { _scoreRelevance as scoreRelevance };

// --- ATS Score Orchestrator ---

/**
 * Compute the overall ATS score for a CV.
 * Without job description: overall = average(format, content), relevance = null.
 * Pure function, returns new object (per D-03, D-08).
 */
export function computeATSScore(cvData: CVData, design: DesignSettings, jobDescription?: string): ATSScoreResult {
  const language = getCVLanguage(cvData);
  const fmt = scoreFormat(cvData, design, language);
  const cnt = scoreContent(cvData, language);

  if (!jobDescription?.trim()) {
    return {
      overall: Math.round((fmt.score + cnt.score) / 2),
      format: fmt.score,
      content: cnt.score,
      relevance: null,
      suggestions: [...fmt.suggestions, ...cnt.suggestions],
    };
  }

  // With JD: weighted score per D-09 formula
  const rel = _scoreRelevance(cvData, jobDescription, language);
  return {
    overall: Math.round(fmt.score * 0.3 + cnt.score * 0.3 + rel.score * 0.4),
    format: fmt.score,
    content: cnt.score,
    relevance: rel.score,
    suggestions: [...fmt.suggestions, ...cnt.suggestions, ...rel.suggestions],
  };
}
