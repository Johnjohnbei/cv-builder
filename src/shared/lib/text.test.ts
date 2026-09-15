import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
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

  // Compatibility forms decompose into the marks folded above
  it('folds the typographic marks the decomposition produces', () => {
    expect(normalizeForMatch(`a${c(0xfe58)}b l${c(0xff40)}a 5${c(0x2034)}`)).toBe("a-b l'a 5'''");
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

  // Skills are listed with commas: "APIs," was one token, never stemmed
  it('matches a plural followed by punctuation', () => {
    expect(matchPhrase('API', prepareText("Conception d'APIs, microservices"))).toBe(true);
    expect(matchPhrase('API', prepareText('Des APIs.'))).toBe(true);
    expect(matchPhrase('designer', prepareText('Nos designers, nos devs'))).toBe(true);
    expect(matchPhrase('Design System', prepareText('Création de Design Systems, tokens'))).toBe(true);
  });

  // "less" stemmed to "les": a Less requirement was found in every French CV
  it('does not stem a technical name into a common word', () => {
    expect(matchPhrase('Less', prepareText('Je gère les projets'))).toBe(false);
    expect(matchPhrase('Sass', prepareText('Société XYZ SAS'))).toBe(false);
    expect(matchPhrase('Unix', prepareText('Université Royaume-Uni'))).toBe(false);
  });

  it('finds a name joined to another by "+"', () => {
    expect(matchPhrase('Bac', prepareText('Bac+5 en informatique'))).toBe(true);
    expect(matchPhrase('React', prepareText('React+Redux'))).toBe(true);
    expect(matchPhrase('C', prepareText('C# et .NET'))).toBe(false);
  });
});

describe('client code', () => {
  // A lookbehind is a SyntaxError before Safari 16.4 (Vite targets safari14):
  // the ATS score runs during render, so one crashed the editor
  it('uses no regex lookbehind', () => {
    const root = path.resolve(__dirname, '../..');
    const offenders = (readdirSync(root, { recursive: true }) as string[])
      .filter(file => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter(file => /\(\?<[=!]/.test(readFileSync(path.join(root, file), 'utf8')));
    expect(offenders).toEqual([]);
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
  it('never strips the s of a double s, nor the x of a short root', () => {
    expect(stripSimpleSuffixes('less')).toBe('less');
    expect(stripSimpleSuffixes('access')).toBe('access');
    expect(stripSimpleSuffixes('unix')).toBe('unix');
    expect(stripSimpleSuffixes('reseaux')).toBe('reseau');
  });
});
