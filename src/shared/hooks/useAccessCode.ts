import { useState, useCallback } from 'react';

const STORAGE_KEY = 'calibre_access_code';

/**
 * Centralized access code management.
 * Single source of truth for reading/writing the access code from localStorage.
 */
export function useAccessCode() {
  const [accessCode, setAccessCode] = useState(() => localStorage.getItem(STORAGE_KEY) || '');

  const saveCode = useCallback((code: string) => {
    localStorage.setItem(STORAGE_KEY, code);
    setAccessCode(code);
  }, []);

  const getCode = useCallback(() => {
    return localStorage.getItem(STORAGE_KEY) || '';
  }, []);

  const clearCode = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAccessCode('');
  }, []);

  const hasCode = accessCode.length > 0;

  return { accessCode, saveCode, getCode, clearCode, hasCode } as const;
}
