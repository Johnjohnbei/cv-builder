// --- Template ATS Compatibility ---

/** Placeholder classifications -- refined in Phase 6 after per-template analysis (per D-04) */
export const TEMPLATE_ATS_COMPAT: Record<string, 'full' | 'limited'> = {
  TEMPLATE_A: 'limited',  // Two-column layout
  TEMPLATE_B: 'full',     // Header-focused, adaptable
  TEMPLATE_C: 'full',     // Minimal single-column
  TEMPLATE_D: 'limited',  // Creative colored sidebar
  TEMPLATE_E: 'full',     // Elegant single-column
  TEMPLATE_F: 'limited',  // Sidebar variant
};

// --- ATS Section Names ---

export const SECTION_NAMES = {
  fr: {
    experience: 'Experience professionnelle',
    education: 'Formation',
    skills: 'Competences',
    languages: 'Langues',
    contact: 'Coordonnees',
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
