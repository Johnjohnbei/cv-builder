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

  describe('one analysis per offer', () => {
    const settle = () => new Promise(resolve => setTimeout(resolve, 0));
    const never = () => new Promise<{ requirements: unknown }>(() => {});

    it('sends one request for an offer asked twice while it runs, then answers from the cache', async () => {
      const tab = await loadModule();
      let answer!: (value: { requirements: unknown }) => void;
      const extract = vi.fn(() => new Promise<{ requirements: unknown }>(resolve => { answer = resolve; }));

      const first = tab.requestRequirements('Offre A', 'code', extract);
      const second = tab.requestRequirements(' Offre A ', 'code', extract);
      answer({ requirements: [R('Figma')] });

      expect(await first).toEqual([R('Figma')]);
      expect(await second).toEqual([R('Figma')]);
      expect(await tab.requestRequirements('Offre A', 'code', extract)).toEqual([R('Figma')]);
      expect(extract).toHaveBeenCalledTimes(1);
    });

    // The editor and the dashboard each hold their own hook
    it('shares a running request between callers', async () => {
      const tab = await loadModule();
      const editor = vi.fn(async () => ({ requirements: [R('Figma')] }));
      const dashboard = vi.fn(async () => ({ requirements: [R('Figma')] }));
      const running = tab.requestRequirements('Offre A', 'code', editor);
      expect(await tab.requestRequirements('Offre A', 'code', dashboard)).toEqual([R('Figma')]);
      await running;
      expect(dashboard).not.toHaveBeenCalled();
    });

    // "Adapter" waits on the ATS tab's analysis, it never pays for one
    it('waits on a running request when asked what is pending, and never starts one', async () => {
      const tab = await loadModule();
      const extract = vi.fn(async () => ({ requirements: [R('Figma')] }));

      expect(tab.pendingRequirements('Offre A', 'code')).toBeUndefined();
      expect(extract).not.toHaveBeenCalled();

      const running = tab.requestRequirements('Offre A', 'code', extract);
      expect(await tab.pendingRequirements('Offre A', 'code')).toEqual([R('Figma')]);
      await running;
      expect(extract).toHaveBeenCalledTimes(1);
    });

    // The server extracts while it tailors: a commit of the same offer meanwhile paid a second time
    it('reads a running tailoring as the analysis of its offer, and caches its requirements', async () => {
      const tab = await loadModule();
      let tailored!: (value: { requirements: unknown }) => void;
      tab.adoptRequirements('Offre A', 'code', new Promise(resolve => { tailored = resolve; }));
      const extract = vi.fn(never);

      const waiting = tab.requestRequirements('Offre A', 'code', extract);
      tailored({ requirements: [R('Figma')] });

      expect(await waiting).toEqual([R('Figma')]);
      expect(extract).not.toHaveBeenCalled();
      expect((await loadModule()).readCachedRequirements('Offre A')).toEqual([R('Figma')]);
    });

    // A tailoring can fail after its extraction succeeded: its error is not the offer's
    it('asks for the requirements itself when the tailoring it waits on fails', async () => {
      const tab = await loadModule();
      let fail!: (error: Error) => void;
      tab.adoptRequirements('Offre A', 'code', new Promise((_, reject) => { fail = reject; }));
      const extract = vi.fn(async () => ({ requirements: [R('SAP')] }));

      const waiting = tab.requestRequirements('Offre A', 'code', extract);
      fail(new Error('AI_INVALID_OUTPUT'));

      expect(await waiting).toEqual([R('SAP')]);
      expect(extract).toHaveBeenCalledTimes(1);
    });

    it('asks again after a failed tailoring', async () => {
      const tab = await loadModule();
      tab.adoptRequirements('Offre A', 'code', Promise.reject(new Error('AI_UNAVAILABLE')));
      await settle();
      const extract = vi.fn(async () => ({ requirements: [R('SAP')] }));
      expect(await tab.requestRequirements('Offre A', 'code', extract)).toEqual([R('SAP')]);
    });

    it('asks again after a failure, and reads an answer without requirements as one', async () => {
      const tab = await loadModule();
      const extract = vi.fn()
        .mockRejectedValueOnce(new Error('AI_UNAVAILABLE'))
        .mockResolvedValueOnce({ requirements: null })
        .mockResolvedValueOnce({ requirements: [R('SAP')] });

      await expect(tab.requestRequirements('Offre A', undefined, extract)).rejects.toThrow();
      await settle();
      await expect(tab.requestRequirements('Offre A', undefined, extract)).rejects.toThrow();
      await settle();
      expect(await tab.requestRequirements('Offre A', undefined, extract)).toEqual([R('SAP')]);
      expect(extract).toHaveBeenCalledTimes(3);
    });

    it('keeps one request per access code', async () => {
      const tab = await loadModule();
      const extract = vi.fn(never);
      void tab.requestRequirements('Offre A', 'code-1', extract);
      void tab.requestRequirements('Offre A', 'code-2', extract);
      expect(extract).toHaveBeenCalledTimes(2);
    });
  });
});
