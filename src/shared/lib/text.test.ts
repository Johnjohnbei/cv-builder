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
  // Offers copied from a website or Word carry typographic punctuation: a quote
  // written with straight marks must still be found in them, and the reverse.
  const c = (...codePoints: number[]) => String.fromCodePoint(...codePoints);

  it('unifies typographic apostrophes, quotes and dashes', () => {
    const typographic = `l${c(0x2019)}anglais ${c(0xab)}Figma${c(0xbb)} full${c(0x2011)}stack ${c(0x2013)} B2B`;
    expect(normalizeForMatch(typographic)).toBe(normalizeForMatch(`l'anglais "Figma" full-stack - B2B`));
  });

  it('drops invisible characters and decomposes ligatures', () => {
    const text = `d${c(0xe9)}velop${c(0xad)}pement certi${c(0xfb01)}cation${c(0x200b)}`;
    expect(normalizeForMatch(text)).toBe('developpement certification');
  });
});
