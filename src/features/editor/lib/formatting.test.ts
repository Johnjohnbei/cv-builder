import { describe, it, expect } from 'vitest';
import { formatDateShort, normalizeProficiency } from './formatting';

// ─── formatDateShort ───

describe('formatDateShort', () => {
  it('returns empty string for undefined', () => {
    expect(formatDateShort(undefined)).toBe('');
    expect(formatDateShort('')).toBe('');
  });

  it('passes through pure year', () => {
    expect(formatDateShort('2021')).toBe('2021');
  });

  it('shortens French month names', () => {
    expect(formatDateShort('Septembre 2021')).toBe('Sept. 2021');
    expect(formatDateShort('Janvier 2024')).toBe('Janv. 2024');
  });

  it('shortens English month names', () => {
    expect(formatDateShort('September 2021')).toBe('Sep. 2021');
    expect(formatDateShort('January 2024')).toBe('Jan. 2024');
  });

  it('handles MM/YYYY format', () => {
    expect(formatDateShort('01/2021')).toBe('Jan. 2021');
    expect(formatDateShort('12/2023')).toBe('Déc. 2023');
  });

  it('handles ISO YYYY-MM format', () => {
    expect(formatDateShort('2021-09')).toBe('Sept. 2021');
    expect(formatDateShort('2023-01')).toBe('Jan. 2023');
  });

  it('returns unknown formats as-is', () => {
    expect(formatDateShort('Q3 2021')).toBe('Q3 2021');
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
