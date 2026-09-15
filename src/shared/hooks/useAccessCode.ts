import { useState, useCallback } from 'react';
import { readStoredText, writeStoredText } from '../lib/storage';

const STORAGE_KEY = 'calibre_access_code';

/**
 * The code storage refused to keep. Module-level, not per hook instance: the
 * dashboard and the editor each call the hook, and a per-instance copy was
 * lost on navigation, so the editor's actions left with no code.
 */
let unsavedCode: string | null = null;

/** Keep `code` ('' clears it): in storage, or in memory for this tab when storage refuses. Exported for unit testing. */
export function storeAccessCode(code: string): void {
  unsavedCode = writeStoredText(STORAGE_KEY, code) ? null : code;
}

/** The code an action sends: the one storage refused, otherwise the stored one. Exported for unit testing. */
export function currentAccessCode(): string {
  return unsavedCode ?? readStoredText(STORAGE_KEY);
}

/**
 * Centralized access code management.
 * Single source of truth for reading/writing the access code from localStorage.
 * Reads and writes go through the storage helpers: a raw read in the state
 * initializer threw on blocked storage and took the whole page down.
 */
export function useAccessCode() {
  const [accessCode, setAccessCode] = useState(currentAccessCode);

  const saveCode = useCallback((code: string) => {
    storeAccessCode(code);
    setAccessCode(code);
  }, []);

  const getCode = useCallback(() => currentAccessCode(), []);

  const clearCode = useCallback(() => {
    storeAccessCode('');
    setAccessCode('');
  }, []);

  const hasCode = accessCode.length > 0;

  return { accessCode, saveCode, getCode, clearCode, hasCode } as const;
}
