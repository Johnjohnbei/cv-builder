import { describe, it, expect } from 'vitest';
import { normalizeForMatch, stripAccents } from './text';

describe('stripAccents', () => {
  it('removes diacritics and keeps case and spacing', () => {
    expect(stripAccents('Société  Générale Ça')).toBe('Societe  Generale Ca');
  });
});

describe('normalizeForMatch', () => {
  it('lowercases and strips French accents', () => {
    expect(normalizeForMatch('Développeur Créatif')).toBe('developpeur creatif');
  });
  it('collapses whitespace', () => {
    expect(normalizeForMatch('  hello    world  ')).toBe('hello world');
  });
  it('handles empty string', () => {
    expect(normalizeForMatch('')).toBe('');
  });
});
