import { describe, it, expect } from 'vitest';
import { formatDateShort, getCurrentLabel, normalizeProficiency } from './formatting';

// ─── formatDateShort ───

describe('formatDateShort (default FR)', () => {
  it('returns empty string for undefined', () => {
    expect(formatDateShort(undefined)).toBe('');
    expect(formatDateShort('')).toBe('');
  });

  it('passes through pure year', () => {
    expect(formatDateShort('2021')).toBe('2021');
  });

  it('translates any input month to FR abbreviation', () => {
    expect(formatDateShort('Septembre 2021')).toBe('Sept. 2021');
    expect(formatDateShort('Janvier 2024')).toBe('Janv. 2024');
    expect(formatDateShort('September 2021')).toBe('Sept. 2021');
    expect(formatDateShort('January 2024')).toBe('Janv. 2024');
  });

  it('handles MM/YYYY format with FR abbreviations', () => {
    expect(formatDateShort('01/2021')).toBe('Janv. 2021');
    expect(formatDateShort('12/2023')).toBe('Déc. 2023');
  });

  it('handles ISO YYYY-MM format with FR abbreviations', () => {
    expect(formatDateShort('2021-09')).toBe('Sept. 2021');
    expect(formatDateShort('2023-01')).toBe('Janv. 2023');
  });

  it('returns unknown formats as-is', () => {
    expect(formatDateShort('Q3 2021')).toBe('Q3 2021');
  });
});

describe('formatDateShort (language = en)', () => {
  it('translates FR month names to EN abbreviations', () => {
    expect(formatDateShort('Mai 2026', 'en')).toBe('May 2026');
    expect(formatDateShort('Septembre 2021', 'en')).toBe('Sep. 2021');
    expect(formatDateShort('Janvier 2024', 'en')).toBe('Jan. 2024');
    expect(formatDateShort('Août 2020', 'en')).toBe('Aug. 2020');
  });

  it('translates EN month names to EN abbreviations', () => {
    expect(formatDateShort('January 2024', 'en')).toBe('Jan. 2024');
    expect(formatDateShort('September 2021', 'en')).toBe('Sep. 2021');
  });

  it('handles MM/YYYY with EN abbreviations', () => {
    expect(formatDateShort('05/2026', 'en')).toBe('May 2026');
    expect(formatDateShort('01/2024', 'en')).toBe('Jan. 2024');
  });

  it('handles ISO YYYY-MM with EN abbreviations', () => {
    expect(formatDateShort('2026-05', 'en')).toBe('May 2026');
    expect(formatDateShort('2023-01', 'en')).toBe('Jan. 2023');
  });
});

describe('getCurrentLabel', () => {
  it('returns Présent in FR', () => {
    expect(getCurrentLabel('fr')).toBe('Présent');
  });

  it('returns Present in EN', () => {
    expect(getCurrentLabel('en')).toBe('Present');
  });
});

// ─── normalizeProficiency ───

describe('normalizeProficiency', () => {
  it('normalizes English LinkedIn proficiencies', () => {
    expect(normalizeProficiency('Native or Bilingual Proficiency')).toBe('Natif / Bilingue');
    expect(normalizeProficiency('Full Professional Proficiency')).toBe('Courant (C1)');
    expect(normalizeProficiency('Elementary Proficiency')).toBe('Débutant (A2)');
  });

  it('passes through already-French proficiencies', () => {
    expect(normalizeProficiency('Courant')).toBe('Courant');
    expect(normalizeProficiency('Natif')).toBe('Natif');
  });
});
