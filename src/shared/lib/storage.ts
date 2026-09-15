/**
 * Read a JSON value from localStorage without letting a corrupt entry take the
 * page down. A value truncated by a full quota, or edited by hand, used to
 * throw straight into the ErrorBoundary on the dashboard and in the editor.
 * Returns `fallback` when the key is absent, unreadable or storage is blocked.
 */
export function readStoredJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

type StorageArea = 'local' | 'session';

/** Resolved inside each caller's try: with site data blocked, even reading window.sessionStorage throws */
const storageOf = (area: StorageArea): Storage => (area === 'session' ? sessionStorage : localStorage);

/** A text value, "" when absent or when storage is blocked (a raw read throws there, during render too) */
export function readStoredText(key: string, area: StorageArea = 'local'): string {
  try {
    return storageOf(area).getItem(key) ?? '';
  } catch {
    return '';
  }
}

/** Shown when writeStoredText refuses: the guest's work lives only in this storage */
export const STORAGE_FAILED_MESSAGE =
  "Enregistrement impossible dans ce navigateur (stockage plein ou bloqué) : retirez la photo ou connectez-vous pour garder vos modifications.";

/**
 * Write a value to localStorage, or remove the key when `text` is empty.
 * False when storage refused it (quota full with a base64 photo, blocked
 * storage): called from timers and effects, the QuotaExceededError used to go
 * uncaught and the guest's edits were silently not kept.
 */
export function writeStoredText(key: string, text: string, area: StorageArea = 'local'): boolean {
  try {
    const storage = storageOf(area);
    if (text) storage.setItem(key, text);
    else storage.removeItem(key);
    return true;
  } catch (e) {
    console.warn(`[storage] could not write ${key}:`, e);
    return false;
  }
}

/**
 * Several keys written as one: when one is refused, those already written get
 * their previous value back (a key absent before is removed again). Written
 * one by one, a full storage could keep the new CV next to the previous draft's
 * offer. ponytail: the rollback is a write too; if storage refuses it as well
 * (space taken meanwhile by another tab), keys stay mixed. The false return
 * still makes every caller report the failure.
 */
export function writeStoredTexts(entries: ReadonlyArray<readonly [key: string, text: string]>): boolean {
  const previous = entries.map(([key]) => [key, readStoredText(key)] as const);
  for (let i = 0; i < entries.length; i++) {
    if (!writeStoredText(entries[i][0], entries[i][1])) {
      for (const [key, text] of previous.slice(0, i)) writeStoredText(key, text);
      return false;
    }
  }
  return true;
}
