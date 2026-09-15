import { describe, it, expect } from 'vitest';
import {
  SECTION_NAMES,
  getSectionTitle,
  SKILL_CATEGORY_NAMES,
  getSkillCategoryTitle,
} from './atsRules';
import type { SectionKey } from './atsRules';
import type { SkillCategoryKey } from './skillDictionary';

describe('atsRules', () => {
  it('exports section names for fr and en', () => {
    expect(SECTION_NAMES.fr.experience).toBe('Expérience professionnelle');
    expect(SECTION_NAMES.en.experience).toBe('Work Experience');
    expect(Object.keys(SECTION_NAMES.fr)).toHaveLength(6);
    expect(Object.keys(SECTION_NAMES.en)).toHaveLength(6);
  });

});

describe('getSectionTitle', () => {
  it('returns correct French section names for all 6 keys', () => {
    expect(getSectionTitle('experience', 'fr')).toBe('Expérience professionnelle');
    expect(getSectionTitle('education', 'fr')).toBe('Formation');
    expect(getSectionTitle('skills', 'fr')).toBe('Compétences');
    expect(getSectionTitle('languages', 'fr')).toBe('Langues');
    expect(getSectionTitle('contact', 'fr')).toBe('Coordonnées');
    expect(getSectionTitle('summary', 'fr')).toBe('Profil professionnel');
  });

  it('returns correct English section names for all 6 keys', () => {
    expect(getSectionTitle('experience', 'en')).toBe('Work Experience');
    expect(getSectionTitle('education', 'en')).toBe('Education');
    expect(getSectionTitle('skills', 'en')).toBe('Skills');
    expect(getSectionTitle('languages', 'en')).toBe('Languages');
    expect(getSectionTitle('contact', 'en')).toBe('Contact Information');
    expect(getSectionTitle('summary', 'en')).toBe('Professional Summary');
  });

  it('has correct function signature with SectionKey type', () => {
    const key: SectionKey = 'experience';
    const result: string = getSectionTitle(key, 'fr');
    expect(typeof result).toBe('string');
  });
});

describe('getSkillCategoryTitle', () => {
  it('returns correct French names for all 5 category keys', () => {
    expect(getSkillCategoryTitle('technical', 'fr')).toBe('Compétences techniques');
    expect(getSkillCategoryTitle('tools', 'fr')).toBe('Outils');
    expect(getSkillCategoryTitle('methodologies', 'fr')).toBe('Méthodologies');
    expect(getSkillCategoryTitle('soft_skills', 'fr')).toBe('Soft Skills');
    expect(getSkillCategoryTitle('other', 'fr')).toBe('Autres');
  });

  it('returns correct English names for all 5 category keys', () => {
    expect(getSkillCategoryTitle('technical', 'en')).toBe('Technical Skills');
    expect(getSkillCategoryTitle('tools', 'en')).toBe('Tools');
    expect(getSkillCategoryTitle('methodologies', 'en')).toBe('Methodologies');
    expect(getSkillCategoryTitle('soft_skills', 'en')).toBe('Soft Skills');
    expect(getSkillCategoryTitle('other', 'en')).toBe('Other');
  });

  it('all 5 keys return non-empty strings for both languages', () => {
    const keys: SkillCategoryKey[] = ['technical', 'tools', 'methodologies', 'soft_skills', 'other'];
    for (const key of keys) {
      expect(getSkillCategoryTitle(key, 'fr').length).toBeGreaterThan(0);
      expect(getSkillCategoryTitle(key, 'en').length).toBeGreaterThan(0);
    }
  });

  it('humanizes snake_case keys and prints typed labels as typed, accents included', () => {
    expect(getSkillCategoryTitle('design_systems' as SkillCategoryKey, 'fr')).toBe('Design Systems');
    expect(getSkillCategoryTitle('Nouvelle Catégorie' as SkillCategoryKey, 'fr')).toBe('Nouvelle Catégorie');
    expect(getSkillCategoryTitle('Outils Design' as SkillCategoryKey, 'en')).toBe('Outils Design');
  });

  it('SKILL_CATEGORY_NAMES has entries for both languages', () => {
    expect(Object.keys(SKILL_CATEGORY_NAMES.fr)).toHaveLength(5);
    expect(Object.keys(SKILL_CATEGORY_NAMES.en)).toHaveLength(5);
  });
});
