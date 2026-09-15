import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { JobRequirement } from '@/src/shared/types';
import { isRequirementsSettled, requirementsForOffer, requirementsStatus } from './jobRequirementsCache';

const R = (label: string): JobRequirement => ({
  id: label.toLowerCase(), label, variants: [], kind: 'tool', importance: 'required', quote: label,
});

const ANALYZED = { offer: 'Product Designer, Figma, design system', requirements: [R('Figma'), R('Design System')] };

describe('requirementsForOffer', () => {
  it('applies the requirements to the offer they were extracted from, whitespace aside', () => {
    expect(requirementsForOffer('  Product Designer, Figma, design system\n', ANALYZED)).toEqual([R('Figma'), R('Design System')]);
  });

  it('applies none while the offer is being edited', () => {
    expect(requirementsForOffer('Product Designer, Sketch, design system', ANALYZED)).toEqual([]);
  });

  it('applies none to another offer pasted after clearing the field', () => {
    expect(requirementsForOffer('Comptable confirmé, SAP, clôture mensuelle', ANALYZED)).toEqual([]);
  });

  it('applies none to an empty field, even when nothing was analyzed', () => {
    expect(requirementsForOffer('', ANALYZED)).toEqual([]);
    expect(requirementsForOffer('', { offer: '', requirements: [R('x')] })).toEqual([]);
  });
});

describe('requirementsStatus', () => {
  const base = { liveOffer: 'Offre A', committedOffer: 'Offre A', requirements: [] as JobRequirement[], failedOffer: '' };

  it('is idle without an offer', () => {
    expect(requirementsStatus({ ...base, liveOffer: '  ' })).toBe('idle');
  });

  it('is ready once the offer on screen has requirements', () => {
    expect(requirementsStatus({ ...base, requirements: [R('Figma')] })).toBe('ready');
  });

  // Nothing runs until the field loses focus: "analysis in progress" would lie
  it('is pending while the offer typed has not been committed', () => {
    expect(requirementsStatus({ ...base, liveOffer: 'Offre A modifiée' })).toBe('pending');
  });

  it('is loading while the committed offer is being analyzed', () => {
    expect(requirementsStatus(base)).toBe('loading');
  });

  it('is failed when the analysis of this very offer failed, whitespace aside', () => {
    expect(requirementsStatus({ ...base, failedOffer: ' Offre A\n' })).toBe('failed');
  });

  it('is pending again when the failed offer is edited', () => {
    expect(requirementsStatus({ ...base, liveOffer: 'Offre B', failedOffer: 'Offre A' })).toBe('pending');
  });
});

// The fit to pages waits for the requirements, never for a failure or no offer
describe('isRequirementsSettled', () => {
  it.each([
    ['idle', true], ['ready', true], ['failed', true], ['loading', false], ['pending', false],
  ] as const)('%s settled: %s', (status, settled) => {
    expect(isRequirementsSettled(status)).toBe(settled);
  });
});

describe('requirements cache', () => {
  let store: Map<string, string>;
  let refuseWrites: boolean;

  /** The module as a fresh page load sees it: the in-memory copy starts empty */
  const loadModule = async () => {
    vi.resetModules();
    return import('./jobRequirementsCache');
  };

  beforeEach(() => {
    store = new Map();
    refuseWrites = false;
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (refuseWrites) throw new Error('QuotaExceededError');
        store.set(k, v);
      },
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  });

  it('answers after a reload from storage, for an earlier offer too', async () => {
    const tab = await loadModule();
    tab.writeCachedRequirements('Offre A', [R('Figma')]);
    tab.writeCachedRequirements('Offre B', [R('SAP')]);

    const reloaded = await loadModule();
    expect(reloaded.readCachedRequirements(' Offre A ')).toEqual([R('Figma')]);
    expect(reloaded.readCachedRequirements('Offre B')).toEqual([R('SAP')]);
  });

  it('keeps the five most recent offers', async () => {
    const tab = await loadModule();
    for (const n of [1, 2, 3, 4, 5, 6]) tab.writeCachedRequirements(`Offre ${n}`, [R(`k${n}`)]);

    const reloaded = await loadModule();
    expect(reloaded.readCachedRequirements('Offre 1')).toBeNull();
    expect(reloaded.readCachedRequirements('Offre 6')).toEqual([R('k6')]);
    expect(reloaded.readCachedRequirements('Offre 2')).toEqual([R('k2')]);
  });

  it('still answers in this tab when storage refuses the write', async () => {
    refuseWrites = true;
    const tab = await loadModule();
    tab.writeCachedRequirements('Offre refusée par le stockage', [R('Figma')]);
    expect(tab.readCachedRequirements('Offre refusée par le stockage')).toEqual([R('Figma')]);
    expect((await loadModule()).readCachedRequirements('Offre refusée par le stockage')).toBeNull();
  });

  it('never reads the former keyword cache, whose entries are plain strings', async () => {
    store.set('ai_keywords_cache', JSON.stringify([{ jobDescription: 'Offre A', keywords: ['Figma'] }]));
    expect((await loadModule()).readCachedRequirements('Offre A')).toBeNull();
  });

  it('skips stored requirements that are not requirements', async () => {
    const badKind = { ...R('Excel'), kind: 'skill' };
    const noQuote = { ...R('Word'), quote: undefined };
    store.set('job_requirements_cache', JSON.stringify([{ jobDescription: 'Offre A', requirements: ['Figma', badKind, noQuote, R('SAP')] }]));
    expect((await loadModule()).readCachedRequirements('Offre A')).toEqual([R('SAP')]);
  });

  // An empty answer would pin the offer to "no requirements" until evicted
  it('answers null for an entry with no valid requirement left, so the offer is analyzed again', async () => {
    store.set('job_requirements_cache', JSON.stringify([{ jobDescription: 'Offre A', requirements: [{ label: 'Figma' }] }]));
    expect((await loadModule()).readCachedRequirements('Offre A')).toBeNull();
  });
});
