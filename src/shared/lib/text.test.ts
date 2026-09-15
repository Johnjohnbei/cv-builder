import { describe, it, expect } from 'vitest';
import { matchPhrase, normalizeForMatch, prepareText, stripAccents, stripSimpleSuffixes } from './text';

/** Characters typed by code point: typographic and invisible ones stay readable here */
const c = (...codePoints: number[]) => String.fromCodePoint(...codePoints);

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
  it('unifies typographic apostrophes, quotes and dashes', () => {
    const typographic = `l${c(0x2019)}anglais ${c(0xab)}Figma${c(0xbb)} ${c(0x2039)}UX${c(0x203a)} full${c(0x2011)}stack ${c(0x2013)} B2B`;
    expect(normalizeForMatch(typographic)).toBe(normalizeForMatch(`l'anglais "Figma" "UX" full-stack - B2B`));
  });

  // Folded before the compatibility decomposition, which splits it into a space and an accent
  it('folds an acute accent used as an apostrophe', () => {
    expect(normalizeForMatch(`l${c(0xb4)}anglais`)).toBe("l'anglais");
  });

  it('drops invisible and direction characters, and decomposes ligatures', () => {
    const text = `d${c(0xe9)}velop${c(0xad)}pement certi${c(0xfb01)}cation${c(0x200b)} ${c(0x200e)}Figma${c(0x202c)}`;
    expect(normalizeForMatch(text)).toBe('developpement certification figma');
  });

  // Decomposed, the trade mark sign became "tm" glued to the word
  it('keeps a brand name apart from its trade mark sign', () => {
    expect(normalizeForMatch(`Salesforce${c(0x2122)} et Excel${c(0xae)}`)).toBe('salesforce et excel');
  });
});

describe('matchPhrase', () => {
  it('matches across accents and plurals', () => {
    expect(matchPhrase('systeme de design', prepareText('Nos Systèmes de Design partagés'))).toBe(true);
  });

  it('requires the words to be adjacent', () => {
    expect(matchPhrase('equipe design', prepareText('Une équipe produit. Le design au cœur.'))).toBe(false);
  });

  it('never matches an empty phrase', () => {
    expect(matchPhrase('   ', prepareText('anything'))).toBe(false);
  });

  it('keeps word boundaries on both sides: Java is not JavaScript, SQL is not NoSQL', () => {
    expect(matchPhrase('java', prepareText('JavaScript on the backend'))).toBe(false);
    expect(matchPhrase('SQL', prepareText('Bases NoSQL'))).toBe(false);
    expect(matchPhrase('Excel', prepareText('Excellent relationnel'))).toBe(false);
  });

  it('keeps word boundaries in non-Latin scripts', () => {
    expect(matchPhrase('язык', prepareText('русский язык'))).toBe(true);
    expect(matchPhrase('яз', prepareText('русский язык'))).toBe(false);
  });

  it('matches a plural in either direction', () => {
    expect(matchPhrase('APIs', prepareText("Conception d'API"))).toBe(true);
    expect(matchPhrase('API', prepareText('Des APIs REST'))).toBe(true);
  });

  it('reads "+" and "#" as part of a name: C is not C++, but is in C/C++', () => {
    expect(matchPhrase('C', prepareText('Expert C++'))).toBe(false);
    expect(matchPhrase('C', prepareText('Langages C/C++'))).toBe(true);
    expect(matchPhrase('C++', prepareText('C++, Java'))).toBe(true);
    expect(matchPhrase('C#', prepareText('Développement en C#.'))).toBe(true);
  });

  it('finds a name starting with a symbol inside a longer one', () => {
    expect(matchPhrase('.NET', prepareText('ASP.NET Core'))).toBe(true);
  });
});

describe('stripSimpleSuffixes', () => {
  it('strips FR plural -s (designers → designer)', () => {
    expect(stripSimpleSuffixes('designers')).toBe('designer');
  });
  it('strips -es (classes → class)', () => {
    expect(stripSimpleSuffixes('classes')).toBe('class');
  });
  it('gives a -e singular and its -es plural the same stem', () => {
    expect(stripSimpleSuffixes('systeme')).toBe(stripSimpleSuffixes('systemes'));
    expect(stripSimpleSuffixes('equipe')).toBe(stripSimpleSuffixes('equipes'));
  });
  it('strips -ing (coding → cod)', () => {
    expect(stripSimpleSuffixes('coding')).toBe('cod');
  });
  it('strips -eur profession suffix (coiffeur → coiff)', () => {
    expect(stripSimpleSuffixes('coiffeur')).toBe('coiff');
  });
  it('does NOT handle FR verb conjugations or -tion derivations', () => {
    expect(stripSimpleSuffixes('gère')).not.toBe(stripSimpleSuffixes('gestion'));
    expect(stripSimpleSuffixes('gestion')).toBe('gestion');
  });
  it('protects short words and leaves stems alone', () => {
    expect(stripSimpleSuffixes('iOS')).toBe('iOS');
    expect(stripSimpleSuffixes('UI')).toBe('UI');
    expect(stripSimpleSuffixes('les')).toBe('les');
    expect(stripSimpleSuffixes('figma')).toBe('figma');
  });
});
