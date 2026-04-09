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
  kpi?: string;
  displayMode?: ExperienceDisplayMode;
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
  sectionTitleWeight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'black';
  sectionTitleTransform?: 'none' | 'uppercase' | 'capitalize';
  sectionTitleSpacing?: 'tight' | 'normal' | 'wide' | 'wider' | 'widest';
  pageLimit?: 1 | 2 | 3 | 4;
  showPhoto?: boolean;
  paperSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  includedSections?: string[];
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

/** Keyword match result for JD-to-CV comparison. */
export interface KeywordMatch {
  keyword: string;
  found: boolean;
  locations: string[];  // CV sections where keyword was found: 'summary' | 'experience' | 'skills' | 'education'
}

/** Full keyword analysis result. */
export interface KeywordAnalysisResult {
  keywords: KeywordMatch[];
  matchedCount: number;
  totalCount: number;
}

export const DEFAULT_DESIGN: DesignSettings = {
  template: 'TEMPLATE_A',
  primaryColor: '#1A73E8',
  secondaryColor: '#5F6368',
  fontFamily: 'sans',
  sectionTitleWeight: 'bold',
  sectionTitleTransform: 'uppercase',
  sectionTitleSpacing: 'widest',
  pageLimit: 1,
  showPhoto: true,
  paperSize: 'a4',
  orientation: 'portrait',
  includedSections: ['personal', 'summary', 'experience', 'education', 'skills', 'languages'],
};

export const EMPTY_CV: CVData = {
  personal_info: { name: '', email: '', title: '' },
  experience: [],
  education: [],
  skills: [],
  languages: [],
};
