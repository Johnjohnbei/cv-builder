import { describe, it, expect } from 'vitest';
import { scoreExperience, relevanceBand, computeKeywordMatch, computeRecency, computeDuration } from './scoring';
import type { Experience } from '@/src/shared/types';

// ─── Helpers ───

function makeExp(overrides: Partial<Experience> = {}): Experience {
  return {
    company: 'Acme',
    position: 'Developer',
    start_date: '2020',
    current: false,
    end_date: '2024',
    description: ['Built stuff'],
    ...overrides,
  };
}

// ─── computeKeywordMatch (word-boundary fix per D-07) ───

describe('computeKeywordMatch', () => {
  it('does NOT match substring keywords (java vs javascript)', () => {
    const exp = makeExp({ position: 'JavaScript Developer', description: ['Built JavaScript apps'] });
    // "java" must NOT match "javascript"
    expect(computeKeywordMatch(exp, ['java'])).toBe(0);
  });

  it('matches exact word keywords', () => {
    const exp = makeExp({ position: 'Java Developer', description: ['Built Java apps'] });
    expect(computeKeywordMatch(exp, ['java'])).toBeGreaterThan(0);
  });

  it('handles special characters in keywords (c++)', () => {
    const exp = makeExp({ position: 'C++ Developer', description: ['C++ programming'] });
    expect(computeKeywordMatch(exp, ['c++'])).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    const exp = makeExp({ position: 'React Developer' });
    expect(computeKeywordMatch(exp, ['react'])).toBeGreaterThan(0);
  });

  it('returns 0 for no matches', () => {
    const exp = makeExp({ position: 'Chef', description: ['Cooking'] });
    expect(computeKeywordMatch(exp, ['react', 'java'])).toBe(0);
  });

  it('returns 100 when all keywords match', () => {
    const exp = makeExp({ position: 'React Java Developer', description: ['Built stuff'] });
    expect(computeKeywordMatch(exp, ['react', 'java'])).toBe(100);
  });
});

// ─── computeRecency ───

describe('computeRecency', () => {
  it('returns 100 for current positions', () => {
    const exp = makeExp({ current: true });
    expect(computeRecency(exp)).toBe(100);
  });

  it('returns lower score for older positions', () => {
    const recent = makeExp({ end_date: '2025' });
    const old = makeExp({ end_date: '2010' });
    expect(computeRecency(recent)).toBeGreaterThan(computeRecency(old));
  });
});

// ─── computeDuration ───

describe('computeDuration', () => {
  it('returns higher score for longer durations', () => {
    const long = makeExp({ start_date: '2015', end_date: '2024' });
    const short = makeExp({ start_date: '2023', end_date: '2024' });
    expect(computeDuration(long)).toBeGreaterThan(computeDuration(short));
  });
});

// ─── scoreExperience ───

describe('scoreExperience', () => {
  it('scores current position highest without keywords', () => {
    const current = makeExp({ current: true, end_date: '' });
    const old = makeExp({ current: false, end_date: '2015' });
    expect(scoreExperience(current, [])).toBeGreaterThan(scoreExperience(old, []));
  });

  // Le défaut signalé le 2026-08-17 : avec l'ancienne pondération
  // (pertinence 0,50 / récence 0,35 / durée 0,15), un poste hors sujet mais
  // actuel affichait 46 % contre 53 % pour un poste parfaitement ciblé mais
  // ancien. Sept points d'écart, donc un tri qui les traitait en quasi-égaux.
  it('un poste hors sujet mais récent reste loin derrière un poste ciblé ancien', () => {
    const kw = ['design system', 'design tokens', 'storybook', 'gouvernance'];
    const cibleAncien = makeExp({
      position: 'Lead Design System', current: false, start_date: '2015-01', end_date: '2018-01',
      description: ['Industrialisé le design system : design tokens, composants, Storybook', 'Gouvernance des composants'],
    });
    const horsSujetActuel = makeExp({
      position: 'Head of Marketing', current: true, end_date: '',
      description: ["Piloté la stratégie d'acquisition payante"],
    });
    const ecart = scoreExperience(cibleAncien, kw) - scoreExperience(horsSujetActuel, kw);
    expect(ecart).toBeGreaterThan(40);
  });

  // La récence garde son rôle, mais seulement à pertinence comparable.
  it('à pertinence égale, la plus récente passe devant', () => {
    const kw = ['react'];
    const base = { position: 'React Developer', description: ['Built React apps'] };
    const recent = makeExp({ ...base, current: true, end_date: '' });
    const ancien = makeExp({ ...base, current: false, start_date: '2010-01', end_date: '2012-01' });
    expect(scoreExperience(recent, kw)).toBeGreaterThan(scoreExperience(ancien, kw));
  });

  it('boosts score with matching keywords', () => {
    const exp = makeExp({ position: 'React Developer', description: ['Built React apps'] });
    const withKw = scoreExperience(exp, ['react', 'developer']);
    const withoutKw = scoreExperience(exp, []);
    expect(withKw).toBeGreaterThan(0);
    expect(withoutKw).toBeGreaterThan(0);
  });

  it('returns 0-100 range', () => {
    const exp = makeExp();
    const score = scoreExperience(exp, ['react']);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('penalizes old experiences', () => {
    const recent = makeExp({ end_date: '2024' });
    const ancient = makeExp({ end_date: '2005' });
    expect(scoreExperience(recent, [])).toBeGreaterThan(scoreExperience(ancient, []));
  });
});

// Les bandes sont calibrées sur des distributions mesurées (cf. le docblock de
// RELEVANCE_BAND_HIGH). Ces tests verrouillent le contrat lisible par l'oeil :
// une expérience ciblée est verte, une expérience hors sujet est rouge.
describe('relevanceBand', () => {
  it('classe en haut une expérience parfaitement ciblée (38-47 % mesurés)', () => {
    expect(relevanceBand(38)).toBe('high');
    expect(relevanceBand(47)).toBe('high');
  });

  it('classe en bas une expérience hors sujet portée par sa seule récence (9-15 % mesurés)', () => {
    expect(relevanceBand(9)).toBe('low');
    expect(relevanceBand(15)).toBe('low');
  });

  it('garde une bande intermédiaire pour les expériences partiellement pertinentes', () => {
    expect(relevanceBand(25)).toBe('medium');
    expect(relevanceBand(31)).toBe('medium');
  });
});
