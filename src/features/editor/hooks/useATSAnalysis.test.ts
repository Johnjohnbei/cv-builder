import { describe, it, expect } from 'vitest';
import { parseDismissedGaps, withDismissed, type DismissedGaps } from './useATSAnalysis';

describe('parseDismissedGaps', () => {
  it('reads the entries of the right shape and skips every other one', () => {
    const raw = [['offre A', ['figma']], 'cassé', ['offre B', 'figma'], [42, ['x']], ['offre C', ['a', 2]], ['offre D', []]];
    expect(parseDismissedGaps(raw)).toEqual([['offre A', ['figma']], ['offre D', []]]);
  });

  it('reads anything that is not a list as no gap dismissed', () => {
    expect(parseDismissedGaps(null)).toEqual([]);
    expect(parseDismissedGaps({ 'offre A': ['figma'] })).toEqual([]);
  });
});

describe('withDismissed', () => {
  const entries: DismissedGaps = [['offre A', ['figma']], ['offre B', ['sketch']]];

  it('puts the offer written first, the others after it', () => {
    expect(withDismissed(entries, 'offre B', ['sketch', 'figma']))
      .toEqual([['offre B', ['sketch', 'figma']], ['offre A', ['figma']]]);
  });

  it('drops an offer left without a gap instead of keeping an empty entry', () => {
    expect(withDismissed(entries, 'offre A', [])).toEqual([['offre B', ['sketch']]]);
  });

  it('keeps the five most recent offers', () => {
    const many = ['1', '2', '3', '4', '5', '6'].reduce<DismissedGaps>((acc, offer) => withDismissed(acc, offer, ['figma']), []);
    expect(many.map(([offer]) => offer)).toEqual(['6', '5', '4', '3', '2']);
  });
});
