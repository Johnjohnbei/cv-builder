// --- Template ATS Compatibility ---

/** Final classifications per D-06 analysis. */
export const TEMPLATE_ATS_COMPAT: Record<string, 'full' | 'limited'> = {
  TEMPLATE_A: 'full',     // Simple single-column layout, easy to convert
  TEMPLATE_B: 'full',     // Header-focused, adaptable
  TEMPLATE_C: 'full',     // Minimal single-column
  TEMPLATE_E: 'full',     // Elegant single-column
};

/** Default fallback template for ATS mode when current template is 'limited' (per D-07). */
export const ATS_FALLBACK_TEMPLATE = 'TEMPLATE_A';

// --- ATS Section Names ---

export const SECTION_NAMES = {
  fr: {
    // Printed as-is in the CV and the .docx: a French title without its
    // accents is a spelling mistake on the document a recruiter reads.
    experience: 'Expérience professionnelle',
    education: 'Formation',
    skills: 'Compétences',
    languages: 'Langues',
    contact: 'Coordonnées',
    summary: 'Profil professionnel',
  },
  en: {
    experience: 'Work Experience',
    education: 'Education',
    skills: 'Skills',
    languages: 'Languages',
    contact: 'Contact Information',
    summary: 'Professional Summary',
  },
} as const;

export type SectionKey = keyof typeof SECTION_NAMES.fr;

/** Returns the ATS-standard section title for a given key and language. */
export function getSectionTitle(key: SectionKey, language: 'fr' | 'en'): string {
  return SECTION_NAMES[language][key];
}

// --- Short / display-friendly section titles ---
// SECTION_NAMES targets ATS parsers (uses formal "Expérience professionnelle" /
// "Professional Summary"). For visual templates that want shorter headers
// ("Profil", "Expérience"), use SHORT_SECTION_NAMES.

export const SHORT_SECTION_NAMES = {
  fr: {
    experience: 'Expérience',
    education: 'Formation',
    skills: 'Compétences',
    languages: 'Langues',
    contact: 'Contact',
    summary: 'Profil',
  },
  en: {
    experience: 'Experience',
    education: 'Education',
    skills: 'Skills',
    languages: 'Languages',
    contact: 'Contact',
    summary: 'Profile',
  },
} as const;

/** Returns the short display title for a given section key and language. */
export function getShortSectionTitle(key: SectionKey, language: 'fr' | 'en'): string {
  return SHORT_SECTION_NAMES[language][key];
}

/** Returns the multi-page continuation marker — " (suite)" in FR, " (cont.)" in EN. */
export function getContinuationMarker(language: 'fr' | 'en'): string {
  return language === 'en' ? ' (cont.)' : ' (suite)';
}

// --- Skill Category Names (bilingual) ---

import type { SkillCategoryKey } from './skillDictionary';

export const SKILL_CATEGORY_NAMES = {
  fr: {
    technical: 'Compétences techniques',
    tools: 'Outils',
    methodologies: 'Méthodologies',
    soft_skills: 'Soft Skills',
    other: 'Autres',
  },
  en: {
    technical: 'Technical Skills',
    tools: 'Tools',
    methodologies: 'Methodologies',
    soft_skills: 'Soft Skills',
    other: 'Other',
  },
} as const;

/** Returns the display name for a skill category key in the given language. */
export function getSkillCategoryTitle(key: SkillCategoryKey, language: 'fr' | 'en'): string {
  const known = SKILL_CATEGORY_NAMES[language][key];
  if (known) return known;
  // A snake_case key gets humanized ("design_systems" → "Design Systems");
  // anything else is a label the user typed and is printed as typed. The old
  // \b\w capitalizer saw accented letters as word breaks and turned
  // "Nouvelle Catégorie" into "Nouvelle CatéGorie".
  if (!/[_-]/.test(key)) return key;
  return key
    .split(/[_-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// --- ATS-Safe Fonts & Styles ---

export const ATS_SAFE_FONTS = ['Arial', 'Calibri', 'Helvetica', 'Times New Roman', 'Georgia'] as const;

export const ATS_COLOR_CONSTRAINTS = {
  minContrast: 4.5,        // WCAG AA minimum
  maxColors: 2,            // primary + text only
  forcedTextColor: '#000', // Black text for ATS
} as const;

// --- Weak Verb Patterns ---

export const WEAK_VERBS = {
  fr: {
    weak: ['responsable de', 'charge de', 'participe a', 'aide a', 'fait', 'gere'],
    strong: ['dirige', 'optimise', 'deploye', 'implemente', 'augmente', 'reduit'],
  },
  en: {
    weak: ['responsible for', 'helped', 'worked on', 'assisted', 'participated in', 'managed'],
    strong: ['led', 'optimized', 'deployed', 'implemented', 'increased', 'reduced'],
  },
} as const;
