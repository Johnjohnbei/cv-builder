import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readStoredText, writeStoredText, writeStoredTexts } from './storage';

/** In-memory localStorage refusing any write to the keys in `full` */
function stubStorage(full: string[] = []) {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (full.includes(k)) throw new Error('QuotaExceededError');
      store.set(k, v);
    },
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
  return store;
}

describe('storage', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('reads "" when storage is blocked instead of throwing', () => {
    globalThis.localStorage = { getItem: () => { throw new Error('SecurityError'); } } as unknown as Storage;
    expect(readStoredText('guest_last_jd')).toBe('');
  });

  it('removes the key for an empty text, and reports a refused write', () => {
    const store = stubStorage(['full']);
    store.set('guest_last_jd', 'Offre A');
    expect(writeStoredText('guest_last_jd', '')).toBe(true);
    expect(store.has('guest_last_jd')).toBe(false);
    expect(writeStoredText('full', 'x')).toBe(false);
  });

  it('writes several keys as one: a refused key restores those already written', () => {
    const store = stubStorage(['guest_last_jd']);
    store.set('guest_last_optimized', 'CV précédent');
    store.set('guest_last_jd', 'Offre précédente');

    expect(writeStoredTexts([['guest_last_optimized', 'Nouveau CV'], ['guest_last_jd', 'Nouvelle offre']])).toBe(false);
    expect(store.get('guest_last_optimized')).toBe('CV précédent');
    expect(store.get('guest_last_jd')).toBe('Offre précédente');
  });

  it('removes again a key that did not exist before the refused write', () => {
    const store = stubStorage(['guest_last_jd']);
    expect(writeStoredTexts([['guest_last_optimized', 'Nouveau CV'], ['guest_last_jd', 'Nouvelle offre']])).toBe(false);
    expect(store.has('guest_last_optimized')).toBe(false);
  });

  it('reports the failure when the rollback is refused too', () => {
    const store = new Map<string, string>([['a', 'A0'], ['b', 'B0']]);
    const attempts: string[] = [];
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      // The first write is accepted, every later one (the second key, then the rollback) refused
      setItem: (k: string, v: string) => {
        attempts.push(`${k}=${v}`);
        if (attempts.length > 1) throw new Error('QuotaExceededError');
        store.set(k, v);
      },
      removeItem: (k: string) => void store.delete(k),
    } as unknown as Storage;

    expect(writeStoredTexts([['a', 'A1'], ['b', 'B1']])).toBe(false);
    // The rollback of "a" was attempted; refused, it leaves the documented mixed state
    expect(attempts).toEqual(['a=A1', 'b=B1', 'a=A0']);
    expect([store.get('a'), store.get('b')]).toEqual(['A1', 'B0']);
  });

  it('reads and writes session storage through the same guards', () => {
    globalThis.sessionStorage = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('SecurityError'); } } as unknown as Storage;
    expect(readStoredText('guest_access', 'session')).toBe('');
    expect(writeStoredText('guest_access', 'true', 'session')).toBe(false);
  });

  it('writes every key when storage accepts them', () => {
    const store = stubStorage();
    expect(writeStoredTexts([['a', '1'], ['b', '2']])).toBe(true);
    expect([store.get('a'), store.get('b')]).toEqual(['1', '2']);
  });
});
