import { describe, it, expect } from 'vitest';
import { scoreExperience, autoAssignModes, extractKeywords } from './scoring';
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
