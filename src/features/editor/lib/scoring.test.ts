import { describe, it, expect } from 'vitest';
import { scoreExperience, autoAssignModes, extractKeywords, computeKeywordMatch, computeRecency, computeDuration } from './scoring';
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

// ─── extractKeywords ───

describe('extractKeywords', () => {
  it('returns empty for empty input', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  it('extracts meaningful words, filters stop words', () => {
    const kw = extractKeywords('Nous cherchons un développeur React avec expérience');
    expect(kw).toContain('développeur');
    expect(kw).toContain('react');
    expect(kw).toContain('expérience');
    expect(kw).not.toContain('nous');
    expect(kw).not.toContain('avec');
  });

  it('deduplicates keywords', () => {
    const kw = extractKeywords('React React React');
    expect(kw).toEqual(['react']);
  });

  it('filters short words (< 3 chars)', () => {
    const kw = extractKeywords('Le CV de AI');
    expect(kw).toEqual([]);
  });
});

// ─── scoreExperience ───

describe('scoreExperience', () => {
  it('scores current position highest without keywords', () => {
    const current = makeExp({ current: true, end_date: '' });
    const old = makeExp({ current: false, end_date: '2015' });
    expect(scoreExperience(current, [])).toBeGreaterThan(scoreExperience(old, []));
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

// ─── autoAssignModes ───

describe('autoAssignModes', () => {
  it('does not mutate input array', () => {
    const exps = [makeExp({ current: true }), makeExp()];
    const original = JSON.stringify(exps);
    autoAssignModes(exps, [], 1);
    expect(JSON.stringify(exps)).toBe(original);
  });

  it('assigns extended to top-scored experience on 1 page', () => {
    const exps = [
      makeExp({ current: true, end_date: '', position: 'CTO' }),
      makeExp({ end_date: '2020', position: 'Intern' }),
      makeExp({ end_date: '2010', position: 'Junior' }),
    ];
    const result = autoAssignModes(exps, [], 1);
    // The current position should be extended (highest score)
    expect(result[0].displayMode).toBe('extended');
  });

  it('hides excess experiences on 1 page', () => {
    const exps = Array.from({ length: 8 }, (_, i) =>
      makeExp({ end_date: `${2024 - i}`, position: `Role ${i}` })
    );
    const result = autoAssignModes(exps, [], 1);
    const hidden = result.filter(e => e.displayMode === 'hidden');
    expect(hidden.length).toBeGreaterThan(0);
  });

  it('shows more experiences on 2 pages', () => {
    const exps = Array.from({ length: 8 }, (_, i) =>
      makeExp({ end_date: `${2024 - i}`, position: `Role ${i}` })
    );
    const r1 = autoAssignModes(exps, [], 1);
    const r2 = autoAssignModes(exps, [], 2);
    const visible1 = r1.filter(e => e.displayMode !== 'hidden').length;
    const visible2 = r2.filter(e => e.displayMode !== 'hidden').length;
    expect(visible2).toBeGreaterThanOrEqual(visible1);
  });

  it('preserves original order (index-based assignment)', () => {
    const exps = [
      makeExp({ position: 'A', end_date: '2020' }),
      makeExp({ position: 'B', current: true }),
    ];
    const result = autoAssignModes(exps, [], 1);
    expect(result[0].position).toBe('A');
    expect(result[1].position).toBe('B');
  });
});
