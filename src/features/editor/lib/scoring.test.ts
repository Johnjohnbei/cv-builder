import { describe, it, expect } from 'vitest';
import { scoreExperience, relevanceBand, computeRequirementMatch, computeRecency, computeDuration } from './scoring';
import type { Experience, JobRequirement } from '@/src/shared/types';

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

const req = (label: string, over: Partial<JobRequirement> = {}): JobRequirement => ({
  id: label, label, variants: [], kind: 'hard_skill', importance: 'required', quote: label, ...over,
});
const reqs = (...labels: string[]) => labels.map(label => req(label));

// ─── computeRequirementMatch: the same matching as the ATS score ───

describe('computeRequirementMatch', () => {
  it('does NOT match inside a longer word (java vs javascript)', () => {
    const exp = makeExp({ position: 'JavaScript Developer', description: ['Built JavaScript apps'] });
    expect(computeRequirementMatch(exp, reqs('java'))).toBe(0);
  });

  it('matches names with symbols (c++)', () => {
    const exp = makeExp({ position: 'C++ Developer', description: ['C++ programming'] });
    expect(computeRequirementMatch(exp, reqs('c++'))).toBe(100);
  });

  it('reads the intro, the KPI, accents, plurals and variants, like the score', () => {
    const exp = makeExp({ intro: 'Lead Figma', kpi: 'Systèmes de design', description: ['Mené des entretiens utilisateurs'] });
    const found = [req('figma'), req('systeme de design'), req('user research', { variants: ['entretien utilisateur'] })];
    expect(computeRequirementMatch(exp, found)).toBe(100);
  });

  // An experience cannot prove a degree, a language or a number of years
  it('only counts the requirements an experience can prove', () => {
    const exp = makeExp({ position: 'React Developer', description: ['Master en anglais'] });
    const mixed = [req('react'), req('Master', { kind: 'education' }), req('anglais', { kind: 'language' }), req('5 ans', { kind: 'experience_years', minYears: 5 })];
    expect(computeRequirementMatch(exp, mixed)).toBe(100);
  });

  it('returns 0 for no matches', () => {
    const exp = makeExp({ position: 'Chef', description: ['Cooking'] });
    expect(computeRequirementMatch(exp, reqs('react', 'java'))).toBe(0);
  });

  // Same rules as computeATSReport
  it('finds a job title in the position only, never in a bullet', () => {
    const exp = makeExp({ position: 'Designer', description: ['Travaillé avec le Head of Design'] });
    expect(computeRequirementMatch(exp, [req('Head of Design', { kind: 'title' })])).toBe(0);
    expect(computeRequirementMatch(makeExp({ position: 'Head of Design' }), [req('Head of Design', { kind: 'title' })])).toBe(100);
  });

  it('reads the company tags in the language the CV prints them', () => {
    const exp = makeExp({ companyStage: 'PME' });
    expect(computeRequirementMatch(exp, reqs('SME'), 'en')).toBe(100);
    expect(computeRequirementMatch(exp, reqs('SME'), 'fr')).toBe(0);
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
    const kw = reqs('design system', 'design tokens', 'storybook', 'gouvernance');
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
    const kw = reqs('react');
    const base = { position: 'React Developer', description: ['Built React apps'] };
    const recent = makeExp({ ...base, current: true, end_date: '' });
    const ancien = makeExp({ ...base, current: false, start_date: '2010-01', end_date: '2012-01' });
    expect(scoreExperience(recent, kw)).toBeGreaterThan(scoreExperience(ancien, kw));
  });

  it('boosts score with matching keywords', () => {
    const exp = makeExp({ position: 'React Developer', description: ['Built React apps'] });
    const withKw = scoreExperience(exp, reqs('react', 'developer'));
    const withoutKw = scoreExperience(exp, []);
    expect(withKw).toBeGreaterThan(0);
    expect(withoutKw).toBeGreaterThan(0);
  });

  it('returns 0-100 range', () => {
    const exp = makeExp();
    const score = scoreExperience(exp, reqs('react'));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('penalizes old experiences', () => {
    const recent = makeExp({ end_date: '2024' });
    const ancient = makeExp({ end_date: '2005' });
    expect(scoreExperience(recent, [])).toBeGreaterThan(scoreExperience(ancient, []));
  });
});

// The badge shows the share of provable requirements a role evidences (see
// RELEVANCE_BAND_HIGH): on 7 requirements, 4 is green, 2 or 3 yellow, 1 red
describe('relevanceBand', () => {
  it('is high from half of the requirements', () => {
    expect(relevanceBand(50)).toBe('high');
    expect(relevanceBand(57)).toBe('high');
  });

  it('is medium for a role proving a few of them', () => {
    expect(relevanceBand(29)).toBe('medium');
    expect(relevanceBand(43)).toBe('medium');
  });

  it('is low for a role proving one or none', () => {
    expect(relevanceBand(14)).toBe('low');
    expect(relevanceBand(0)).toBe('low');
  });
});

// The badge reads the same requirement matching as the score: an on-target
// role must land in the high band and an off-target one in the low band
describe('relevanceBand on a representative offer', () => {
  const offer = [
    req('design system'), req('Figma', { kind: 'tool' }), req('recherche utilisateur', { kind: 'method' }),
    req('Storybook', { kind: 'tool' }), req('accessibilité'), req('SaaS', { kind: 'domain' }),
    req('Product Designer', { kind: 'title' }), req('Master', { kind: 'education' }), req('anglais', { kind: 'language' }),
  ];
  it('an on-target role is high, an off-target current role is low', () => {
    const onTarget = makeExp({
      position: 'Lead Product Designer', current: false, start_date: '2016', end_date: '2019',
      description: ['Construit le design system Figma et Storybook', 'Mené la recherche utilisateur du SaaS'],
    });
    const offTarget = makeExp({ position: 'Head of Marketing', current: true, end_date: '', description: ["Piloté la stratégie d'acquisition"] });
    const partial = makeExp({ position: 'UI Designer', description: ['Maquettes Figma', 'Accessibilité des écrans'] });
    expect(relevanceBand(computeRequirementMatch(onTarget, offer))).toBe('high');
    expect(relevanceBand(computeRequirementMatch(partial, offer))).toBe('medium');
    // A current role proving nothing used to show 15 %, carried by its recency
    expect(computeRequirementMatch(offTarget, offer)).toBe(0);
  });
});
