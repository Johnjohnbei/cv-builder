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
  it('strips FR plural -s from designers', () => {
    expect(stripSimpleSuffixes('designers')).toBe('design');
  });
  it('strips -tion from gestion', () => {
    expect(stripSimpleSuffixes('gestion')).toBe('ges');
  });
  it('strips -ing from coding', () => {
    expect(stripSimpleSuffixes('coding')).toBe('cod');
  });
  it('protects words < 4 chars (UI, iOS)', () => {
    expect(stripSimpleSuffixes('iOS')).toBe('iOS');
    expect(stripSimpleSuffixes('UI')).toBe('UI');
  });
  it('does not over-strip short roots', () => {
    // "les" would become "" without the min-root-3 guard — must stay "les"
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
  it('matches via -tion suffix strip', () => {
    expect(matchKeywordFuzzy('gestion', 'gère les équipes et la gestion des projets')).toBe(true);
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
