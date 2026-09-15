import { describe, it, expect, beforeEach, vi } from 'vitest';
import { keywordsForOffer } from './aiKeywordCache';

const ANALYZED = { offer: 'Product Designer, Figma, design system', keywords: ['Figma', 'Design System'] };

describe('keywordsForOffer', () => {
  it('applies the keywords to the offer they were extracted from, whitespace aside', () => {
    expect(keywordsForOffer('  Product Designer, Figma, design system\n', ANALYZED)).toEqual(['Figma', 'Design System']);
  });

  it('applies none while the offer is being edited', () => {
    expect(keywordsForOffer('Product Designer, Sketch, design system', ANALYZED)).toEqual([]);
  });

  it('applies none to another offer pasted after clearing the field', () => {
    expect(keywordsForOffer('Comptable confirmé, SAP, clôture mensuelle', ANALYZED)).toEqual([]);
  });

  it('applies none to an empty field, even when nothing was analyzed', () => {
    expect(keywordsForOffer('', ANALYZED)).toEqual([]);
    expect(keywordsForOffer('', { offer: '', keywords: ['x'] })).toEqual([]);
  });
});

describe('keyword cache', () => {
  let store: Map<string, string>;
  let refuseWrites: boolean;

  /** The module as a fresh page load sees it: the in-memory copy starts empty */
  const loadModule = async () => {
    vi.resetModules();
    return import('./aiKeywordCache');
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
    tab.writeCachedKeywords('Offre A', ['Figma']);
    tab.writeCachedKeywords('Offre B', ['SAP']);

    const reloaded = await loadModule();
    expect(reloaded.readCachedKeywords(' Offre A ')).toEqual(['Figma']);
    expect(reloaded.readCachedKeywords('Offre B')).toEqual(['SAP']);
  });

  it('keeps the five most recent offers', async () => {
    const tab = await loadModule();
    for (const n of [1, 2, 3, 4, 5, 6]) tab.writeCachedKeywords(`Offre ${n}`, [`k${n}`]);

    const reloaded = await loadModule();
    expect(reloaded.readCachedKeywords('Offre 1')).toBeNull();
    expect(reloaded.readCachedKeywords('Offre 6')).toEqual(['k6']);
    expect(reloaded.readCachedKeywords('Offre 2')).toEqual(['k2']);
  });

  it('still answers in this tab when storage refuses the write', async () => {
    refuseWrites = true;
    const tab = await loadModule();
    tab.writeCachedKeywords('Offre refusée par le stockage', ['Figma']);
    expect(tab.readCachedKeywords('Offre refusée par le stockage')).toEqual(['Figma']);
    expect((await loadModule()).readCachedKeywords('Offre refusée par le stockage')).toBeNull();
  });

  it('still reads the single-offer format written before', async () => {
    store.set('ai_keywords_cache', JSON.stringify({ jobDescription: 'Offre A', keywords: ['Figma'] }));
    expect((await loadModule()).readCachedKeywords('Offre A')).toEqual(['Figma']);
  });
});
