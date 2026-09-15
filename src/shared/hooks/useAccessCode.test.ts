import { describe, it, expect, beforeEach, vi } from 'vitest';

let store: Map<string, string>;
let refuseWrites: boolean;

/** A fresh module, as a new tab sees it: no code held in memory */
const loadModule = async () => {
  vi.resetModules();
  return import('./useAccessCode');
};

describe('access code kept for the tab', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    store = new Map();
    refuseWrites = false;
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (refuseWrites) throw new Error('QuotaExceededError');
        store.set(k, v);
      },
      removeItem: (k: string) => void store.delete(k),
    } as unknown as Storage;
  });

  it('sends the code storage refused, from any page of the tab', async () => {
    refuseWrites = true;
    const { storeAccessCode, currentAccessCode } = await loadModule();
    storeAccessCode('CODE-DASHBOARD');
    // The editor reads through the same module, not a copy of its own
    expect(currentAccessCode()).toBe('CODE-DASHBOARD');
  });

  it('reads storage again once a later save succeeds', async () => {
    const { storeAccessCode, currentAccessCode } = await loadModule();
    refuseWrites = true;
    storeAccessCode('REFUSED');
    refuseWrites = false;
    storeAccessCode('KEPT');
    expect(currentAccessCode()).toBe('KEPT');
    expect(store.get('calibre_access_code')).toBe('KEPT');
  });

  it('clears the code even when storage refuses the removal: a code the server refused is never sent again', async () => {
    store.set('calibre_access_code', 'OLD');
    const { storeAccessCode, currentAccessCode } = await loadModule();
    globalThis.localStorage.removeItem = () => { throw new Error('SecurityError'); };
    storeAccessCode('');
    expect(currentAccessCode()).toBe('');
  });

  it('reads the stored code when nothing was refused', async () => {
    store.set('calibre_access_code', 'STORED');
    expect((await loadModule()).currentAccessCode()).toBe('STORED');
  });
});
