import { describe, it, expect } from 'vitest';
import { detectCVLanguage, getCVLanguage, extractCVText } from './languageDetection';
import type { CVData } from '../shared/types';

const EMPTY_CV: CVData = {
  personal_info: { name: '', email: '' },
  experience: [],
  education: [],
  skills: [],
  languages: [],
};

const FRENCH_CV: CVData = {
  personal_info: {
    name: 'Jean Dupont',
    email: 'jean@example.com',
    title: 'Ingenieur logiciel senior',
    summary: "Ingenieur logiciel avec plus de dix ans d'experience dans le developpement d'applications web et mobiles. Expertise en architecture logicielle et gestion d'equipes techniques.",
  },
  experience: [
    {
      company: 'Entreprise Technologique',
      position: 'Ingenieur principal',
      start_date: '2020-01',
      current: true,
      intro: "Responsable de l'architecture technique et de la supervision des projets de developpement.",
      description: [
        "Conception et mise en oeuvre d'une architecture microservices pour une plateforme de commerce electronique.",
        "Direction d'une equipe de huit developpeurs avec methodologie agile et revues de code regulieres.",
      ],
    },
  ],
  education: [],
  skills: [{ category: 'Competences techniques', items: ['JavaScript', 'TypeScript', 'React', 'Node.js'] }],
  languages: [],
};

const ENGLISH_CV: CVData = {
  personal_info: {
    name: 'John Smith',
    email: 'john@example.com',
    title: 'Senior Software Engineer',
    summary: 'Experienced software engineer with over ten years of expertise in developing scalable web applications and leading cross-functional engineering teams.',
  },
  experience: [
    {
      company: 'Tech Corporation',
      position: 'Lead Engineer',
      start_date: '2020-01',
      current: true,
      intro: 'Led the technical architecture and development oversight for enterprise applications.',
      description: [
        'Designed and implemented a microservices architecture serving over two million daily active users.',
        'Managed a team of eight developers using agile methodology with regular code reviews and sprint planning.',
      ],
    },
  ],
  education: [],
  skills: [{ category: 'Technical Skills', items: ['JavaScript', 'TypeScript', 'React', 'Node.js'] }],
  languages: [],
};

describe('extractCVText', () => {
  it('concatenates title, summary, experience fields, and skills', () => {
    const text = extractCVText(ENGLISH_CV);
    expect(text).toContain('Senior Software Engineer');
    expect(text).toContain('scalable web applications');
    expect(text).toContain('Lead Engineer');
    expect(text).toContain('microservices architecture');
    expect(text).toContain('JavaScript');
  });

  it('returns empty string for empty CV', () => {
    const text = extractCVText(EMPTY_CV);
    expect(text.trim()).toBe('');
  });
});

describe('detectCVLanguage', () => {
  it('returns "fr" for French CV text', () => {
    expect(detectCVLanguage(FRENCH_CV)).toBe('fr');
  });

  it('returns "en" for English CV text', () => {
    expect(detectCVLanguage(ENGLISH_CV)).toBe('en');
  });

  it('returns "fr" for short/empty text (< 20 chars)', () => {
    expect(detectCVLanguage(EMPTY_CV)).toBe('fr');
  });

  it('returns "fr" for CV with minimal text', () => {
    const minimalCV: CVData = {
      ...EMPTY_CV,
      personal_info: { name: 'A', email: 'a@b.c', title: 'Dev' },
    };
    expect(detectCVLanguage(minimalCV)).toBe('fr');
  });
});

describe('getCVLanguage', () => {
  it('returns languageOverride when set', () => {
    const cv: CVData = { ...FRENCH_CV, detectedLanguage: 'fr', languageOverride: 'en' };
    expect(getCVLanguage(cv)).toBe('en');
  });

  it('returns detectedLanguage when no override', () => {
    const cv: CVData = { ...ENGLISH_CV, detectedLanguage: 'en' };
    expect(getCVLanguage(cv)).toBe('en');
  });

  it('returns "fr" when both undefined', () => {
    expect(getCVLanguage(EMPTY_CV)).toBe('fr');
  });

  it('override takes precedence over detection', () => {
    const cv: CVData = { ...ENGLISH_CV, detectedLanguage: 'en', languageOverride: 'fr' };
    expect(getCVLanguage(cv)).toBe('fr');
  });
});
