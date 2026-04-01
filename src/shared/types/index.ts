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

export interface Experience {
  company: string;
  position: string;
  location?: string;
  start_date: string;
  end_date?: string;
  current: boolean;
  description: string[];
}

export interface Education {
  school: string;
  degree: string;
  field?: string;
  start_date: string;
  end_date?: string;
}

export interface SkillCategory {
  category: string;
  items: string[];
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
  pageLimit?: 1 | 2;
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
}

export interface ATSResult {
  score: number;
  missingKeywords: string[];
  strengths: string[];
  improvements: string[];
  ats_compatibility: 'LOW' | 'MEDIUM' | 'HIGH';
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
