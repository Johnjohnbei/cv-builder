import { describe, it, expect } from 'vitest';
import {
  matchKeywordFuzzy,
  normalizeForMatch,
  stripSimpleSuffixes,
  computeKeywordAnalysis,
} from '../keywordAnalysis';
import type { CVData } from '@/src/shared/types';

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

describe('stripSimpleSuffixes', () => {
  // ─── In-scope: what the stemmer intentionally covers ───

  it('strips FR plural -s (designers → designer)', () => {
    // Conservative: keeps the meaningful root "designer" rather than over-stripping to "design".
    expect(stripSimpleSuffixes('designers')).toBe('designer');
  });
  it('strips -es (classes → class)', () => {
    expect(stripSimpleSuffixes('classes')).toBe('class');
  });
  it('strips -ing (coding → cod)', () => {
    expect(stripSimpleSuffixes('coding')).toBe('cod');
  });
  it('strips -eur profession suffix (coiffeur → coiff)', () => {
    expect(stripSimpleSuffixes('coiffeur')).toBe('coiff');
  });

  // ─── Out-of-scope: documents what the stemmer does NOT attempt ───

  it('does NOT handle FR verb conjugations (gère stays gère)', () => {
    // A more aggressive stemmer could map gère ↔ gestion but hand-rolled
    // suffix-strip is too blunt. Deferred to a real FR stemmer library.
    expect(stripSimpleSuffixes('gère')).toBe('gère');
  });
  it('does NOT handle -tion derivations (gestion stays gestion)', () => {
    // Previously stripped to 'ges' — too aggressive, caused false positives.
    expect(stripSimpleSuffixes('gestion')).toBe('gestion');
  });

  // ─── Guard: min root length of 3 chars ───

  it('protects short words < 4 chars (iOS, UI)', () => {
    expect(stripSimpleSuffixes('iOS')).toBe('iOS');
    expect(stripSimpleSuffixes('UI')).toBe('UI');
  });
  it('does not over-strip: "les" stays "les" (stripping -es would leave "l", < 3 chars)', () => {
    expect(stripSimpleSuffixes('les')).toBe('les');
  });
  it('leaves already-stemmed words alone', () => {
    expect(stripSimpleSuffixes('figma')).toBe('figma');
  });
});

describe('matchKeywordFuzzy', () => {
  it('matches exact keyword (fast path)', () => {
    expect(matchKeywordFuzzy('React', 'I use React daily')).toBe(true);
  });
  it('matches plural in text from singular keyword', () => {
    expect(matchKeywordFuzzy('designer', 'team of 5 designers')).toBe(true);
  });
  it('matches singular when text has plural (stemmed)', () => {
    expect(matchKeywordFuzzy('user', 'worked with users and stakeholders')).toBe(true);
  });
  it('matches despite accent mismatch (keyword accented, text not)', () => {
    expect(matchKeywordFuzzy('développeur', 'developpeur senior')).toBe(true);
  });
  it('matches despite accent mismatch (text accented, keyword not)', () => {
    expect(matchKeywordFuzzy('developpeur', 'Développeur Full Stack')).toBe(true);
  });
  it('matches profession suffix (coiffeur → coiffeurs via -eurs)', () => {
    expect(matchKeywordFuzzy('coiffeur', 'équipe de 5 coiffeurs')).toBe(true);
  });
  it('matches multi-word keyword (AND semantics)', () => {
    expect(matchKeywordFuzzy('design system', 'refonte du design system multi-marque')).toBe(true);
  });
  it('rejects multi-word when one token is missing', () => {
    expect(matchKeywordFuzzy('machine learning', 'worked with machines only')).toBe(false);
  });
  it('rejects clearly absent keyword', () => {
    expect(matchKeywordFuzzy('kubernetes', 'React and TypeScript on the frontend')).toBe(false);
  });
  it('word-boundary: Java does not match JavaScript', () => {
    expect(matchKeywordFuzzy('java', 'JavaScript on the backend')).toBe(false);
  });

  // ─── Honest documentation of what fuzzy does NOT cover ───

  it('does NOT match FR verb conjugations — piloter/pilote are different tokens', () => {
    // "piloter" stemmed is "pilot", "pilote" stemmed is "pilot" — actually matches!
    // But a derived noun like "pilotage" → "pilotag" does NOT match "pilote" → "pilot".
    // Locked as negative to prevent regressions on an overly-aggressive stemmer.
    expect(matchKeywordFuzzy('pilotage', 'pilote la refonte')).toBe(false);
  });
  it('does NOT match synonyms / abbreviations (React ↔ ReactJS)', () => {
    expect(matchKeywordFuzzy('reactjs', 'React on the frontend')).toBe(false);
  });
});

describe('computeKeywordAnalysis with fuzzy matching', () => {
  const cvData: CVData = {
    personal_info: { name: 'X', email: 'x@y.z', title: 'Designer' },
    experience: [
      {
        company: 'Acme',
        position: 'Senior Designer',
        start_date: '2020',
        current: true,
        intro: 'Leads the design system team',
        description: ['Pilote la refonte du design system', 'Gère une équipe de 8 designers'],
        kpi: 'Équipe de 8',
        displayMode: 'normal',
      },
    ],
    education: [],
    skills: [{ category: 'Tools', items: ['Figma', 'Sketch'] }],
    languages: [],
  };

  it('marks accented keyword as found when CV uses accented form', () => {
    const result = computeKeywordAnalysis(
      cvData,
      'Looking for an équipe lead',
      'fr',
      ['équipe']
    );
    expect(result.matchedCount).toBe(1);
  });

  it('marks multi-word keyword as found via fuzzy match', () => {
    const result = computeKeywordAnalysis(
      cvData,
      'Need design system expertise',
      'fr',
      ['design system']
    );
    expect(result.matchedCount).toBe(1);
  });

  it('marks singular keyword as found when CV has plural', () => {
    const result = computeKeywordAnalysis(
      cvData,
      'Designer role',
      'fr',
      ['designer']
    );
    expect(result.matchedCount).toBe(1);
  });

  it('still flags genuinely missing keywords', () => {
    const result = computeKeywordAnalysis(
      cvData,
      'Kubernetes role',
      'fr',
      ['kubernetes']
    );
    expect(result.matchedCount).toBe(0);
  });
});
