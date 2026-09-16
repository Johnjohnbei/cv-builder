import { describe, it, expect } from 'vitest';
import { offerKey, parseDismissedGaps, withDismissed, type DismissedGaps } from './useATSAnalysis';

describe('parseDismissedGaps', () => {
  it('reads the entries of the right shape and skips every other one', () => {
    const raw = [['offre A', ['figma']], 'cassé', ['offre B', 'figma'], [42, ['x']], ['offre C', ['a', 2]], ['offre D', []]];
    expect(parseDismissedGaps(raw)).toEqual([[offerKey('offre A'), ['figma']], [offerKey('offre D'), []]]);
  });

  it('names again an entry written when the offers were kept whole', () => {
    const offer = 'Product Designer. Requis : Figma.';
    expect(parseDismissedGaps([[offer, ['figma']]])).toEqual([[offerKey(offer), ['figma']]]);
    // A fingerprint is left alone, never fingerprinted twice
    expect(parseDismissedGaps([[offerKey(offer), ['figma']]])).toEqual([[offerKey(offer), ['figma']]]);
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

describe('offerKey', () => {
  const OFFER = 'Product Designer. Requis : Figma, Kubernetes.';

  it('names an offer by a short fingerprint, not by the offer itself', () => {
    const key = offerKey('x'.repeat(20_000));
    expect(key.length).toBeLessThan(20);
    expect(key).not.toContain('x'.repeat(20));
  });

  it('gives the same name to the same offer, spacing around it aside', () => {
    expect(offerKey(OFFER)).toBe(offerKey(`  ${OFFER}
`));
  });

  it('gives another name to another offer, one character apart included', () => {
    expect(offerKey(OFFER)).not.toBe(offerKey(`${OFFER} Anglais.`));
    expect(offerKey('Figma')).not.toBe(offerKey('Figmb'));
  });

  it('names an empty offer with nothing', () => {
    expect(offerKey('   ')).toBe('');
  });
});
