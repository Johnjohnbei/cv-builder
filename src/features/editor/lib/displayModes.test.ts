import { describe, it, expect } from 'vitest';
import { getVisibleBullets, getIntro, getActionBullets, shouldShowKPI, isHidden, isCompact, getVisibleSkills, isSkillHidden } from './displayModes';
import type { Experience, SkillCategory } from '@/src/shared/types';

function makeExp(overrides: Partial<Experience> = {}): Experience {
  return {
    company: 'Acme',
    position: 'Dev',
    start_date: '2020',
    current: false,
    description: ['Intro line', 'Bullet 1', 'Bullet 2', 'Bullet 3', 'Bullet 4'],
    ...overrides,
  };
}

function makeSkills(overrides: Partial<SkillCategory> = {}): SkillCategory {
  return {
    category: 'Tech',
    items: ['React', 'TypeScript', 'Node', 'Python', 'Go'],
    ...overrides,
  };
}

// ─── getVisibleBullets ───

describe('getVisibleBullets', () => {
  it('returns 0 bullets for hidden mode', () => {
    expect(getVisibleBullets(makeExp({ displayMode: 'hidden' }))).toEqual([]);
  });

  it('returns 0 bullets for compact mode', () => {
    expect(getVisibleBullets(makeExp({ displayMode: 'compact' }))).toEqual([]);
  });

  it('returns 2 bullets for normal mode', () => {
    expect(getVisibleBullets(makeExp({ displayMode: 'normal' }))).toHaveLength(2);
  });

  it('returns up to 4 bullets for extended mode', () => {
    expect(getVisibleBullets(makeExp({ displayMode: 'extended' }))).toHaveLength(4);
  });

  it('defaults to normal when displayMode is undefined', () => {
    expect(getVisibleBullets(makeExp({ displayMode: undefined }))).toHaveLength(2);
  });
});

// ─── getIntro ───

describe('getIntro', () => {
  it('returns dedicated intro field when present', () => {
    expect(getIntro(makeExp({ intro: 'My intro' }))).toBe('My intro');
  });

  it('falls back to first description item', () => {
    expect(getIntro(makeExp({ intro: undefined }))).toBe('Intro line');
  });

  it('returns null for empty experience', () => {
    expect(getIntro(makeExp({ intro: undefined, description: [] }))).toBeNull();
  });
});

// ─── getActionBullets ───

describe('getActionBullets', () => {
  it('excludes intro from description[0] when no dedicated intro', () => {
    const bullets = getActionBullets(makeExp({ displayMode: 'normal', intro: undefined }));
    expect(bullets).toEqual(['Bullet 1', 'Bullet 2']);
  });

  it('includes all description as bullets when dedicated intro exists', () => {
    const bullets = getActionBullets(makeExp({ displayMode: 'normal', intro: 'Dedicated intro' }));
    expect(bullets).toEqual(['Intro line', 'Bullet 1']);
  });

  it('returns empty for hidden mode', () => {
    expect(getActionBullets(makeExp({ displayMode: 'hidden' }))).toEqual([]);
  });

  it('returns empty for compact mode', () => {
    expect(getActionBullets(makeExp({ displayMode: 'compact' }))).toEqual([]);
  });
});

// ─── shouldShowKPI ───

describe('shouldShowKPI', () => {
  it('returns true for extended with kpi', () => {
    expect(shouldShowKPI(makeExp({ displayMode: 'extended', kpi: '+35% CA' }))).toBe(true);
  });

  it('returns false for extended without kpi', () => {
    expect(shouldShowKPI(makeExp({ displayMode: 'extended', kpi: undefined }))).toBe(false);
  });

  it('returns false for normal mode even with kpi', () => {
    expect(shouldShowKPI(makeExp({ displayMode: 'normal', kpi: '+35% CA' }))).toBe(false);
  });
});

// ─── isHidden / isCompact ───

describe('isHidden / isCompact', () => {
  it('detects hidden mode', () => {
    expect(isHidden(makeExp({ displayMode: 'hidden' }))).toBe(true);
    expect(isHidden(makeExp({ displayMode: 'normal' }))).toBe(false);
  });

  it('detects compact mode', () => {
    expect(isCompact(makeExp({ displayMode: 'compact' }))).toBe(true);
    expect(isCompact(makeExp({ displayMode: 'extended' }))).toBe(false);
  });
});

// ─── Skills display modes ───

describe('getVisibleSkills', () => {
  it('returns all items for normal mode', () => {
    expect(getVisibleSkills(makeSkills())).toHaveLength(5);
  });

  it('returns top 3 for compact mode', () => {
    expect(getVisibleSkills(makeSkills({ displayMode: 'compact' }))).toEqual(['React', 'TypeScript', 'Node']);
  });

  it('returns empty for hidden mode', () => {
    expect(getVisibleSkills(makeSkills({ displayMode: 'hidden' }))).toEqual([]);
  });
});

describe('isSkillHidden', () => {
  it('detects hidden skills', () => {
    expect(isSkillHidden(makeSkills({ displayMode: 'hidden' }))).toBe(true);
    expect(isSkillHidden(makeSkills())).toBe(false);
  });
});
