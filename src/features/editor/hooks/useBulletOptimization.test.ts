import { describe, it, expect } from 'vitest';
import { flattenVisibleBullets, applyRewriteToCV } from './useBulletOptimization';
import type { Experience } from '@/src/shared/types';

const makeExp = (
  position: string,
  bullets: string[],
  displayMode: Experience['displayMode'] = 'normal',
): Experience => ({
  company: 'Acme',
  position,
  start_date: '2020',
  current: true,
  description: bullets,
  kpi: '',
  displayMode,
});

describe('flattenVisibleBullets', () => {
  it('returns empty result for empty experience list', () => {
    const out = flattenVisibleBullets([]);
    expect(out.bullets).toEqual([]);
    expect(out.indexMap).toEqual([]);
  });

  it('flattens bullets preserving order', () => {
    const exp = [
      makeExp('Designer', ['a', 'b']),
      makeExp('Developer', ['c']),
    ];
    const out = flattenVisibleBullets(exp);
    expect(out.bullets).toHaveLength(3);
    expect(out.bullets[0].text).toBe('a');
    expect(out.bullets[1].text).toBe('b');
    expect(out.bullets[2].text).toBe('c');
  });

  it('assigns stable flat indices starting at 0', () => {
    const exp = [makeExp('A', ['x', 'y']), makeExp('B', ['z'])];
    const out = flattenVisibleBullets(exp);
    expect(out.bullets.map(b => b.index)).toEqual([0, 1, 2]);
  });

  it('builds a correct indexMap reverse lookup', () => {
    const exp = [makeExp('A', ['x', 'y']), makeExp('B', ['z'])];
    const out = flattenVisibleBullets(exp);
    expect(out.indexMap[0]).toEqual({ expIndex: 0, bulletIndex: 0 });
    expect(out.indexMap[1]).toEqual({ expIndex: 0, bulletIndex: 1 });
    expect(out.indexMap[2]).toEqual({ expIndex: 1, bulletIndex: 0 });
  });

  it('skips hidden experiences entirely', () => {
    const exp = [
      makeExp('Visible', ['a']),
      makeExp('Hidden', ['b', 'c'], 'hidden'),
      makeExp('AlsoVisible', ['d']),
    ];
    const out = flattenVisibleBullets(exp);
    expect(out.bullets.map(b => b.text)).toEqual(['a', 'd']);
    // indexMap skips the hidden experience — note expIndex for 'd' is still 2, not 1
    expect(out.indexMap[1]).toEqual({ expIndex: 2, bulletIndex: 0 });
  });

  it('carries position and company on each bullet ref', () => {
    const exp = [makeExp('Senior Designer', ['bullet'])];
    const out = flattenVisibleBullets(exp);
    expect(out.bullets[0].position).toBe('Senior Designer');
    expect(out.bullets[0].company).toBe('Acme');
  });
});

describe('applyRewriteToCV', () => {
  const base = [
    makeExp('A', ['a0', 'a1', 'a2']),
    makeExp('B', ['b0', 'b1']),
  ];

  it('returns a new array (immutable)', () => {
    const out = applyRewriteToCV(base, 0, 1, 'rewritten');
    expect(out).not.toBe(base);
    expect(out[0]).not.toBe(base[0]);
    expect(out[1]).toBe(base[1]); // untouched experience keeps reference equality
  });

  it('replaces the target bullet', () => {
    const out = applyRewriteToCV(base, 0, 1, 'rewritten');
    expect(out[0].description).toEqual(['a0', 'rewritten', 'a2']);
  });

  it('leaves other bullets untouched', () => {
    const out = applyRewriteToCV(base, 0, 0, 'new');
    expect(out[0].description[1]).toBe('a1');
    expect(out[0].description[2]).toBe('a2');
  });

  it('returns the input unchanged when expIdx is out of bounds', () => {
    const out = applyRewriteToCV(base, 99, 0, 'rewritten');
    expect(out).toBe(base);
  });

  it('returns the input unchanged when bulIdx is out of bounds', () => {
    const out = applyRewriteToCV(base, 0, 99, 'rewritten');
    expect(out).toBe(base);
  });

  it('returns the input unchanged when expIdx is negative', () => {
    const out = applyRewriteToCV(base, -1, 0, 'rewritten');
    expect(out).toBe(base);
  });
});
