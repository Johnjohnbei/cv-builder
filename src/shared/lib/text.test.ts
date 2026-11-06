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

  // The offer gives the label, so it is always the CV that writes the name the
  // other way: measured on 14 cases, every one of them counted lost (2026-11-06)
  it('reads a technical name whatever separates its parts', () => {
    const found = (term: string, cv: string) => matchPhrase(term, prepareText(cv));
    expect(found('CI/CD', 'pipelines CI / CD')).toBe(true);
    expect(found('CI/CD', 'Pipelines CICD GitLab')).toBe(true);
    expect(found('full-stack', 'Developpeur full stack')).toBe(true);
    expect(found('full stack', 'Developpeur full-stack')).toBe(true);
    expect(found('e-commerce', 'Projets ecommerce B2C')).toBe(true);
    expect(found('front-end', 'Developpement frontend React')).toBe(true);
    expect(found('back-end', 'Back end Node')).toBe(true);
    expect(found('data-driven', 'Culture data driven')).toBe(true);
  });

  it('reads a framework with or without its js', () => {
    const found = (term: string, cv: string) => matchPhrase(term, prepareText(cv));
    expect(found('React.js', 'React, TypeScript, Node')).toBe(true);
    expect(found('Node.js', 'Node et Express')).toBe(true);
    expect(found('Vue.js', 'Vue, Nuxt')).toBe(true);
    expect(found('Angular', 'AngularJS legacy')).toBe(true);
    expect(found('React', 'React.js et Redux')).toBe(true);
    // The rule stops at the js: Java is still not JavaScript
    expect(found('Java', 'JavaScript on the backend')).toBe(false);
  });

  // Two very short parts are written in either order, longer ones are not
  it('reads UX/UI as UI/UX, and never front-end as end-front', () => {
    expect(matchPhrase('UX/UI', prepareText('UI/UX Designer senior'))).toBe(true);
    expect(matchPhrase('front-end', prepareText('end front developer'))).toBe(false);
  });

  // Under four characters nothing is stemmed and a word boundary is cheap:
  // these are the names of the languages and tools offers filter on
  it('does not find a short name in a common word or a compound', () => {
    expect(matchPhrase('Vue', prepareText("Une vue d'ensemble du produit"))).toBe(false);
    expect(matchPhrase('Go', prepareText('Go-to-market strategy'))).toBe(false);
    expect(matchPhrase('R', prepareText('R&D chez Thales'))).toBe(false);
    expect(matchPhrase('Office', prepareText('Gestion du back-office'))).toBe(false);
    // And still finds them where they are named
    expect(matchPhrase('Vue', prepareText('Vue, Nuxt, Tailwind'))).toBe(true);
    expect(matchPhrase('Go', prepareText('Langages : Go, Python'))).toBe(true);
    expect(matchPhrase('R', prepareText('Python, R, SQL'))).toBe(true);
    expect(matchPhrase('Office', prepareText('Suite Office 365'))).toBe(true);
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
  it('never strips the s of a double s, and strips x only as a French plural in -aux, -eux, -oux', () => {
    expect(stripSimpleSuffixes('less')).toBe('less');
    expect(stripSimpleSuffixes('access')).toBe('access');
    expect(stripSimpleSuffixes('reseaux')).toBe('reseau');
    expect(stripSimpleSuffixes('jeux')).toBe('jeu');
    expect(stripSimpleSuffixes('bijoux')).toBe('bijou');
    for (const name of ['unix', 'linux', 'redux', 'choix', 'flux']) expect(stripSimpleSuffixes(name)).toBe(name);
  });

  it('matches a French plural in -x', () => {
    expect(matchPhrase('jeu vidéo', prepareText('Industrie des jeux vidéo'))).toBe(true);
  });
});
