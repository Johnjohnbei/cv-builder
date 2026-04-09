import { describe, it, expect } from 'vitest';
import { extractExpectedText, validateCVTextExtractability } from './pdfValidation';
import type { CVData } from '@/src/shared/types';

const fullCV: CVData = {
  personal_info: {
    name: 'Jean Dupont',
    email: 'jean@example.com',
    phone: '+33 6 12 34 56 78',
    location: 'Paris, France',
    title: 'Ingenieur Logiciel',
    summary: 'Developpeur senior avec 10 ans experience',
  },
  experience: [
    {
      company: 'Acme Corp',
      position: 'Lead Developer',
      start_date: '2020-01',
      current: true,
      description: ['Built microservices architecture', 'Led team of 5 engineers'],
      displayMode: 'normal',
    },
    {
      company: 'Beta Inc',
      position: 'Junior Dev',
      start_date: '2018-01',
      end_date: '2019-12',
      current: false,
      description: ['Maintained legacy systems'],
      displayMode: 'hidden',
    },
  ],
  education: [
    {
      school: 'Universite Paris-Saclay',
      degree: 'Master',
      field: 'Informatique',
      start_date: '2015-09',
      end_date: '2017-06',
    },
  ],
  skills: [
    { category: 'Frontend', items: ['React', 'TypeScript'], displayMode: 'normal' },
    { category: 'Backend', items: ['Node.js', 'Python'], displayMode: 'hidden' },
  ],
  languages: [
    { name: 'Francais', proficiency: 'Natif' },
    { name: 'Anglais', proficiency: 'Courant' },
  ],
};

const emptyCV: CVData = {
  personal_info: { name: '', email: '' },
  experience: [],
  education: [],
  skills: [],
  languages: [],
};

// ─── extractExpectedText ───

describe('extractExpectedText', () => {
  it('returns concatenated text from full CVData', () => {
    const text = extractExpectedText(fullCV);
    expect(text).toContain('Jean Dupont');
    expect(text).toContain('jean@example.com');
    expect(text).toContain('Ingenieur Logiciel');
    expect(text).toContain('Developpeur senior avec 10 ans experience');
    expect(text).toContain('Acme Corp');
    expect(text).toContain('Lead Developer');
    expect(text).toContain('Built microservices architecture');
    expect(text).toContain('Universite Paris-Saclay');
    expect(text).toContain('React');
    expect(text).toContain('TypeScript');
    expect(text).toContain('Francais');
    expect(text).toContain('Anglais');
  });

  it('returns empty string for empty CVData', () => {
    const text = extractExpectedText(emptyCV);
    expect(text.trim()).toBe('');
  });

  it('skips hidden experiences', () => {
    const text = extractExpectedText(fullCV);
    expect(text).not.toContain('Beta Inc');
    expect(text).not.toContain('Junior Dev');
    expect(text).not.toContain('Maintained legacy systems');
  });

  it('skips hidden skill categories', () => {
    const text = extractExpectedText(fullCV);
    expect(text).not.toContain('Node.js');
    expect(text).not.toContain('Python');
  });
});

// ─── validateCVTextExtractability ───

describe('validateCVTextExtractability', () => {
  it('returns valid when ratio >= 0.6', () => {
    const expected = 'one two three four five six seven eight nine ten';
    const rendered = 'one two three four five six seven eight'; // 8/10 = 0.8
    const result = validateCVTextExtractability(rendered, expected);
    expect(result.valid).toBe(true);
    expect(result.ratio).toBeGreaterThanOrEqual(0.6);
    expect(result.warning).toBeUndefined();
  });

  it('returns invalid with warning when ratio < 0.6', () => {
    const expected = 'one two three four five six seven eight nine ten';
    const rendered = 'one two three'; // 3/10 = 0.3
    const result = validateCVTextExtractability(rendered, expected);
    expect(result.valid).toBe(false);
    expect(result.ratio).toBeLessThan(0.6);
    expect(result.warning).toContain('peu de texte extractible');
  });

  it('returns invalid with zero-text warning when rendered text is empty', () => {
    const expected = 'one two three four five';
    const result = validateCVTextExtractability('', expected);
    expect(result.valid).toBe(false);
    expect(result.ratio).toBe(0);
    expect(result.warning).toContain('aucun texte extractible');
  });

  it('returns valid when expected text is empty', () => {
    const result = validateCVTextExtractability('some rendered text', '');
    expect(result.valid).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('returns valid at exactly 0.6 ratio', () => {
    const expected = 'a b c d e f g h i j'; // 10 tokens
    const rendered = 'a b c d e f'; // 6 tokens => 0.6
    const result = validateCVTextExtractability(rendered, expected);
    expect(result.valid).toBe(true);
    expect(result.ratio).toBeCloseTo(0.6);
  });
});
