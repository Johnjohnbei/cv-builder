// Shared types — single source of truth for the entire app

export interface PersonalInfo {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  title?: string;
  summary?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  photo_url?: string;
  /** Portfolio link printed in the CV header (label + URL) */
  portfolio_url?: string;
  portfolio_label?: string;
  /**
   * Identity-free variant of the portfolio link. When the anonymize toggle is
   * on this replaces portfolio_url, so a blind application still carries a
   * portfolio instead of losing it — the other contact fields are blanked.
   */
  portfolio_anon_url?: string;
}

/**
 * Personal fields the user owns outright: never handed to the AI to rewrite,
 * and identical in every language. The photo is a base64 payload worth tens of
 * thousands of tokens; the portfolio link is a deliberate choice. Sent to the
 * model, both came back dropped, so a rewrite silently removed the portfolio.
 */
export const USER_OWNED_PERSONAL_FIELDS = ['photo_url', 'portfolio_url', 'portfolio_label', 'portfolio_anon_url'] as const;
type UserOwnedField = typeof USER_OWNED_PERSONAL_FIELDS[number];

const isUserOwned = (key: string) => (USER_OWNED_PERSONAL_FIELDS as readonly string[]).includes(key);

/** The user-owned fields set on `info`, and nothing else. */
export function pickUserOwnedFields(info: Partial<PersonalInfo> | undefined): Pick<PersonalInfo, UserOwnedField> {
  return Object.fromEntries(
    Object.entries(info ?? {}).filter(([key, value]) => isUserOwned(key) && typeof value === 'string'),
  );
}

/** `info` without its user-owned fields. */
export function omitUserOwnedFields<T extends Partial<PersonalInfo>>(info: T): Omit<T, UserOwnedField> {
  return Object.fromEntries(Object.entries(info).filter(([key]) => !isUserOwned(key))) as Omit<T, UserOwnedField>;
}

export type ExperienceDisplayMode = 'hidden' | 'compact' | 'normal' | 'extended';

export interface Experience {
  company: string;
  position: string;
  location?: string;
  start_date: string;
  end_date?: string;
  current: boolean;
  intro?: string;           // Short description of the role (1-2 lines, always visible except hidden)
  description: string[];    // Action bullet points (shown based on displayMode)
  kpi?: string;             // Result / scope indicator ("Team of 12", "+35% traffic", etc.)
  /**
   * Override KPI visibility:
   * - undefined (default) → visible only when displayMode === 'extended'
   * - true                → always visible (if kpi is non-empty)
   * - false               → always hidden
   */
  showKpi?: boolean;
  displayMode?: ExperienceDisplayMode;
  /** Company maturity tag deduced or set by user (Startup, Scaleup, PME, etc.) */
  companyStage?: string;
  /** Company business model deduced or set by user (B2C, B2B, SaaS, Marketplace, etc.) */
  companyBusinessModel?: string;
}

export interface Education {
  school: string;
  degree: string;
  field?: string;
  start_date: string;
  end_date?: string;
}

export type SkillDisplayMode = 'hidden' | 'compact' | 'normal';

export interface SkillCategory {
  category: string;
  items: string[];
  displayMode?: SkillDisplayMode;
}

export interface Language {
  name: string;
  proficiency: string;
}

export interface DesignSettings {
  template: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: 'sans' | 'serif' | 'mono' | 'playfair' | 'outfit';
  /**
   * Target page count. Pagination never truncates — this is the budget the
   * fit-to-pages pass condenses towards, and the length the AI rewrite is
   * asked to respect. Defaults to 2.
   */
  pageLimit?: number;
  showPhoto?: boolean;
  /** Sections shown in the preview, the PDF and the .docx. undefined = all */
  includedSections?: string[];
  atsMode?: boolean;
}

/** Subset of CVData that is language-specific. Stored in `_translations` so a
 *  language switch is a free toggle on subsequent passes (no LLM round-trip). */
export interface TranslatableContent {
  personal_info: PersonalInfo;
  experience: Experience[];
  education: Education[];
  skills: SkillCategory[];
  languages: Language[];
}

export interface CVData {
  personal_info: PersonalInfo;
  experience: Experience[];
  education: Education[];
  skills: SkillCategory[];
  languages: Language[];
  design?: DesignSettings;
  detectedLanguage?: 'fr' | 'en';
  languageOverride?: 'fr' | 'en';
  /** Per-language snapshot cache. Populated lazily the first time the user
   *  switches to that language. Reading: just swap content. Writing: only
   *  on translate flow. May go stale if user edits content; that's accepted. */
  _translations?: Partial<Record<'fr' | 'en', TranslatableContent>>;
}

/** @deprecated Use ATSScoreResult instead. Will be removed in a future version. */
export interface ATSResult {
  score: number;
  missingKeywords: string[];
  strengths: string[];
  improvements: string[];
  ats_compatibility: 'LOW' | 'MEDIUM' | 'HIGH';
}

/** ATS score breakdown per D-11 spec. */
export interface ATSScoreResult {
  overall: number;
  format: number;
  content: number;
  relevance: number | null;
  suggestions: string[];
}

/** Where a missing keyword should be integrated. */
export interface KeywordPlacement {
  type: 'experience' | 'summary' | 'skill';
  /** For experience: index into cvData.experience */
  expIndex?: number;
  /** Short label for the UI, e.g. "Lead Product Design @ TF1" */
  label: string;
}

/** Keyword match result for JD-to-CV comparison. */
export interface KeywordMatch {
  keyword: string;
  found: boolean;
  locations: string[];  // CV sections where keyword was found: 'summary' | 'experience' | 'skills' | 'education'
  /** Best place to integrate this keyword when missing (null if found) */
  placement: KeywordPlacement | null;
}

/** Full keyword analysis result. */
export interface KeywordAnalysisResult {
  keywords: KeywordMatch[];
  matchedCount: number;
  totalCount: number;
}

export const DEFAULT_DESIGN: DesignSettings = {
  // Elegant: single column, ATS-compatible, and the layout the fit-to-pages
  // pass is calibrated against.
  template: 'TEMPLATE_E',
  primaryColor: '#1A73E8',
  secondaryColor: '#5F6368',
  // Mirrors TEMPLATE_DEFAULTS.TEMPLATE_E in useTemplateSelection — a fresh CV
  // must look exactly like one where the user picked Elegant by hand.
  fontFamily: 'outfit',
  pageLimit: 2,
  showPhoto: true,
  includedSections: ['personal', 'summary', 'experience', 'education', 'skills', 'languages'],
};

export const EMPTY_CV: CVData = {
  personal_info: { name: '', email: '', title: '' },
  experience: [],
  education: [],
  skills: [],
  languages: [],
};
