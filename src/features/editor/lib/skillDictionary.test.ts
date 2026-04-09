import { describe, it, expect } from 'vitest';
import {
  categorizeSkills,
  SKILL_CATEGORY_ORDER,
  type SkillCategoryKey,
} from './skillDictionary';

describe('SKILL_CATEGORY_ORDER', () => {
  it('has exactly 5 categories in the correct order', () => {
    expect(SKILL_CATEGORY_ORDER).toEqual([
      'technical',
      'tools',
      'methodologies',
      'soft_skills',
      'other',
    ]);
  });
});

describe('categorizeSkills', () => {
  it('categorizes a mixed set of skills into correct categories', () => {
    const result = categorizeSkills(['React', 'Python', 'Docker', 'Agile', 'Leadership']);
    expect(result).toHaveLength(4);
    expect(result[0].category).toBe('technical');
    expect(result[0].items).toEqual(['React', 'Python']);
    expect(result[1].category).toBe('tools');
    expect(result[1].items).toEqual(['Docker']);
    expect(result[2].category).toBe('methodologies');
    expect(result[2].items).toEqual(['Agile']);
    expect(result[3].category).toBe('soft_skills');
    expect(result[3].items).toEqual(['Leadership']);
  });

  it('puts unknown skills into "other" category', () => {
    const result = categorizeSkills(['UnknownThing']);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ category: 'other', items: ['UnknownThing'] });
  });

  it('is case insensitive', () => {
    const result1 = categorizeSkills(['REACT']);
    const result2 = categorizeSkills(['react']);
    expect(result1[0].category).toBe('technical');
    expect(result2[0].category).toBe('technical');
  });

  it('handles French accent-insensitive matching', () => {
    const result = categorizeSkills(['Gestion de projet']);
    expect(result[0].category).toBe('methodologies');
  });

  it('matches compound phrases as whole', () => {
    const result = categorizeSkills(['Machine Learning']);
    expect(result[0].category).toBe('technical');
    expect(result[0].items).toEqual(['Machine Learning']);
  });

  it('strips .js/.ts suffixes for matching', () => {
    const result = categorizeSkills(['React.js']);
    expect(result[0].category).toBe('technical');
    expect(result[0].items).toEqual(['React.js']); // original casing preserved
  });

  it('omits empty categories from output', () => {
    const result = categorizeSkills(['React', 'Python']);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('technical');
  });

  it('preserves original skill casing in items', () => {
    const result = categorizeSkills(['REACT', 'Docker', 'agile']);
    expect(result[0].items).toEqual(['REACT']);
    expect(result[1].items).toEqual(['Docker']);
    expect(result[2].items).toEqual(['agile']);
  });

  it('returns empty array for empty input', () => {
    expect(categorizeSkills([])).toEqual([]);
  });

  it('returns categories in SKILL_CATEGORY_ORDER', () => {
    const result = categorizeSkills(['Leadership', 'Docker', 'Agile', 'React', 'XYZunknown']);
    const categories = result.map(r => r.category);
    expect(categories).toEqual(['technical', 'tools', 'methodologies', 'soft_skills', 'other']);
  });

  it('handles French skills correctly', () => {
    const result = categorizeSkills(['Travail en equipe', 'Developpement web']);
    const cats = result.map(r => r.category);
    expect(cats).toContain('soft_skills');
    expect(cats).toContain('technical');
  });

  it('handles multiple skills per category', () => {
    const result = categorizeSkills(['React', 'Python', 'TypeScript', 'Java']);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('technical');
    expect(result[0].items).toHaveLength(4);
  });

  it('strips technology prefixes for matching', () => {
    const result = categorizeSkills(['Microsoft Excel']);
    expect(result.some(r => r.category !== 'other')).toBe(true);
  });
});
