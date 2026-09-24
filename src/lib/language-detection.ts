import type { CVData } from '../shared/types';

export type SupportedLanguage = 'fr' | 'en';

const MIN_TEXT_LENGTH = 20;

// Stop-word scoring needs SEPARATE per-language lists: a merged FR+EN set
// cannot score FR vs EN. These local
// lists keep only high-frequency function words that are unambiguous between
// the two languages (no 'car', 'son', 'as', 'on', 'an': they exist in both).
const FR_STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'en', 'est', 'sont',
  'être', 'avoir', 'ne', 'pas', 'plus', 'dans', 'pour', 'avec', 'sur', 'par',
  'au', 'aux', 'ce', 'cet', 'cette', 'ces', 'qui', 'que', 'dont', 'où',
  'nous', 'vous', 'ils', 'elle', 'elles', 'votre', 'notre', 'vos', 'nos',
  'leur', 'leurs', 'sa', 'ses', 'mais', 'donc', 'chez', 'sans', 'sous',
  'vers', 'entre', 'depuis', 'avant', 'après', 'ainsi', 'aussi', 'tout',
  'tous', 'toute', 'toutes', 'comme', 'très', 'bien', 'été', 'fait', 'faire',
  'afin', 'était', 'étaient', 'ont', 'avez', 'avons', 'sera', 'seront',
]);

const EN_STOP_WORDS = new Set([
  'the', 'and', 'of', 'to', 'in', 'is', 'are', 'was', 'were', 'be', 'been',
  'for', 'with', 'that', 'this', 'these', 'those', 'will', 'would', 'can',
  'could', 'should', 'have', 'has', 'had', 'not', 'but', 'from', 'they',
  'their', 'them', 'you', 'your', 'we', 'our', 'us', 'it', 'its', 'at', 'by',
  'or', 'if', 'all', 'more', 'most', 'other', 'into', 'over', 'about', 'than',
  'then', 'also', 'when', 'which', 'who', 'what', 'how', 'there', 'here',
  'each', 'both', 'may', 'must', 'do', 'does', 'did', 'while', 'through',
]);

/**
 * Extracts concatenated text from CV data for language detection.
 * Combines: title, summary, experience positions/intros/descriptions, skill items.
 */
export function extractCVText(cvData: CVData): string {
  const parts: string[] = [];

  if (cvData.personal_info.title) parts.push(cvData.personal_info.title);
  if (cvData.personal_info.summary) parts.push(cvData.personal_info.summary);

  for (const exp of cvData.experience) {
    if (exp.position) parts.push(exp.position);
    if (exp.intro) parts.push(exp.intro);
    for (const desc of exp.description) {
      parts.push(desc);
    }
  }

  for (const cat of cvData.skills) {
    parts.push(...cat.items);
  }

  return parts.join(' ');
}

// Tie-breakers for texts with no stop word at all, such as an offer written as
// a list ("Requirements: Figma, design systems, 5+ years"): section words of a
// job offer that exist in one language only. Such offers used to be detected
// as French, and the CV and the letter were written in the wrong language.
const EN_OFFER_WORDS = new Set([
  'requirements', 'responsibilities', 'qualifications', 'skills', 'years', 'experience',
  'knowledge', 'ability', 'benefits', 'salary', 'remote', 'hybrid', 'degree', 'strong',
  'required', 'preferred', 'working', 'hiring', 'job', 'role',
]);
const FR_OFFER_WORDS = new Set([
  'expérience', 'compétences', 'profil', 'missions', 'poste', 'années', 'ans', 'équipe',
  'maîtrise', 'connaissance', 'diplôme', 'rémunération', 'télétravail', 'avantages',
  'recherchons', 'rejoindre', 'souhaité', 'requis',
]);

function countTokens(tokens: string[], frWords: Set<string>, enWords: Set<string>): { fr: number; en: number } {
  let fr = 0;
  let en = 0;
  for (const token of tokens) {
    if (token.length < 2) continue;
    if (frWords.has(token)) fr++;
    else if (enWords.has(token)) en++;
  }
  return { fr, en };
}

/**
 * Detects the language of an arbitrary text by counting FR vs EN stop words.
 * Majority wins. On a tie (typically no stop word at all), job-offer section
 * words decide. Short text (< 20 chars) and texts still undecided fall back to
 * 'fr' (product default). Technical EN jargon inside French prose does not
 * flip the result: jargon words are neither stop words nor section words.
 */
export function detectTextLanguage(text: string): SupportedLanguage {
  if (text.length < MIN_TEXT_LENGTH) {
    return 'fr';
  }
  const tokens = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  const stop = countTokens(tokens, FR_STOP_WORDS, EN_STOP_WORDS);
  if (stop.en !== stop.fr) return stop.en > stop.fr ? 'en' : 'fr';
  const offer = countTokens(tokens, FR_OFFER_WORDS, EN_OFFER_WORDS);
  return offer.en > offer.fr ? 'en' : 'fr';
}

/**
 * Detects the language of a job description.
 * Thin semantic wrapper around detectTextLanguage so callers expressing intent.
 */
export function detectJobDescriptionLanguage(jobDescription: string): SupportedLanguage {
  return detectTextLanguage(jobDescription);
}

/**
 * Detects the language of a CV from its concatenated text.
 * Returns 'fr' for short/empty text or when detection is undetermined.
 */
export function detectCVLanguage(cvData: CVData): SupportedLanguage {
  return detectTextLanguage(extractCVText(cvData));
}

/**
 * Returns the effective language for downstream systems.
 * Priority: languageOverride > detectedLanguage > 'fr' (default).
 */
export function getCVLanguage(cvData: CVData): SupportedLanguage {
  return cvData.languageOverride ?? cvData.detectedLanguage ?? 'fr';
}
