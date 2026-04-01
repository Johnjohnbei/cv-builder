export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  linkedin_url?: string;
  base_cv_json?: CVData;
  created_at: string;
}

export interface CVData {
  personal_info: {
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
  };
  experience: Experience[];
  education: Education[];
  skills: SkillCategory[];
  languages: Language[];
  design?: DesignSettings;
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

export interface SkillCategory {
  category: string;
  items: string[];
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

export interface JobDescription {
  id: string;
  user_id: string;
  job_title: string;
  company_name: string;
  raw_text: string;
  extracted_keywords?: string[];
  created_at: string;
}

export interface GeneratedCV {
  id: string;
  user_id: string;
  job_id: string;
  tailored_content: CVData;
  design_template_id: string;
  created_at: string;
}
