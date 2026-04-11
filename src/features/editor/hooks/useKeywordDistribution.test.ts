import { describe, it, expect } from 'vitest';
import { applyAssignments, stripNonContent } from './useKeywordDistribution';
import type { DistributionProposal } from './useKeywordDistribution';
import type { CVData, Experience } from '@/src/shared/types';

const makeExp = (position: string, bullets: string[]): Experience => ({
  company: 'Acme',
  position,
  start_date: '2020',
  current: true,
  description: bullets,
  kpi: '',
  displayMode: 'normal',
});

describe('stripNonContent', () => {
  it('keeps every content field', () => {
    const cv: CVData = {
      personal_info: { name: 'X', email: 'x@y.z' },
      experience: [makeExp('Dev', ['a'])],
      education: [{ school: 'S', degree: 'D', start_date: '2015' }],
      skills: [{ category: 'Tech', items: ['TS'] }],
      languages: [{ name: 'FR', proficiency: 'Natif' }],
      design: { template: 'TEMPLATE_A', primaryColor: '#000', secondaryColor: '#fff', fontFamily: 'sans' },
    };
    const out = stripNonContent(cv);
    expect(out.personal_info).toBe(cv.personal_info);
    expect(out.experience).toBe(cv.experience);
    expect(out.education).toBe(cv.education);
    expect(out.skills).toBe(cv.skills);
    expect(out.languages).toBe(cv.languages);
  });

  it('strips design and language override fields', () => {
    const cv: CVData = {
      personal_info: { name: 'X', email: 'x@y.z' },
      experience: [],
      education: [],
      skills: [],
      languages: [],
      design: { template: 'TEMPLATE_A', primaryColor: '#000', secondaryColor: '#fff', fontFamily: 'sans' },
      detectedLanguage: 'fr',
      languageOverride: 'en',
    };
    const out = stripNonContent(cv) as Record<string, unknown>;
    expect(out.design).toBeUndefined();
    expect(out.detectedLanguage).toBeUndefined();
    expect(out.languageOverride).toBeUndefined();
  });
});

describe('applyAssignments', () => {
  const baseExp = [
    makeExp('Senior Designer', ['bullet 0', 'bullet 1', 'bullet 2']),
    makeExp('Junior Designer', ['bullet A', 'bullet B']),
  ];

  const proposal = (
    keyword: string,
    expIndex: number | null,
    bulletIndex: number | null,
    rewrittenBullet: string | null,
  ): DistributionProposal => ({
    keyword,
    expIndex,
    bulletIndex,
    originalBullet: null,
    rewrittenBullet,
    reason: '',
    expLabel: '',
  });

  it('returns a new array (immutable)', () => {
    const out = applyAssignments(baseExp, [proposal('X', 0, 0, 'rewritten 0')]);
    expect(out).not.toBe(baseExp);
    expect(out[0]).not.toBe(baseExp[0]);
  });

  it('rewrites the targeted bullet', () => {
    const out = applyAssignments(baseExp, [proposal('X', 0, 1, 'rewritten 1')]);
    expect(out[0].description).toEqual(['bullet 0', 'rewritten 1', 'bullet 2']);
  });

  it('applies multiple proposals targeting the same experience in one pass', () => {
    const out = applyAssignments(baseExp, [
      proposal('X', 0, 0, 'rewritten 0'),
      proposal('Y', 0, 2, 'rewritten 2'),
    ]);
    expect(out[0].description).toEqual(['rewritten 0', 'bullet 1', 'rewritten 2']);
  });

  it('applies proposals across multiple experiences', () => {
    const out = applyAssignments(baseExp, [
      proposal('X', 0, 0, 'rewritten A'),
      proposal('Y', 1, 1, 'rewritten B'),
    ]);
    expect(out[0].description[0]).toBe('rewritten A');
    expect(out[1].description[1]).toBe('rewritten B');
  });

  it('preserves experiences without matching proposals', () => {
    const out = applyAssignments(baseExp, [proposal('X', 0, 0, 'rewritten 0')]);
    expect(out[1]).toBe(baseExp[1]); // reference equality — no change
  });

  it('skips proposals with null expIndex', () => {
    const out = applyAssignments(baseExp, [proposal('X', null, 0, 'rewritten')]);
    expect(out[0].description).toEqual(['bullet 0', 'bullet 1', 'bullet 2']);
    expect(out[1].description).toEqual(['bullet A', 'bullet B']);
  });

  it('skips proposals with null bulletIndex', () => {
    const out = applyAssignments(baseExp, [proposal('X', 0, null, 'rewritten')]);
    expect(out[0].description).toEqual(['bullet 0', 'bullet 1', 'bullet 2']);
  });

  it('skips proposals with null rewrittenBullet', () => {
    const out = applyAssignments(baseExp, [proposal('X', 0, 0, null)]);
    expect(out[0].description).toEqual(['bullet 0', 'bullet 1', 'bullet 2']);
  });

  it('returns an empty-proposals case unchanged', () => {
    const out = applyAssignments(baseExp, []);
    expect(out).toHaveLength(2);
    expect(out[0].description).toEqual(baseExp[0].description);
    expect(out[1].description).toEqual(baseExp[1].description);
  });
});
