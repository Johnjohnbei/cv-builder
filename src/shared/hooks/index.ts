import { useState, useEffect } from 'react';

export { useAccessCode } from './useAccessCode';
export { useDocumentTitle } from './useDocumentTitle';

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export function useAutoNotification() {
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Errors stay long enough to be read; successes clear quickly
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), notification.type === 'error' ? 10000 : 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return { notification, notify: setNotification, clearNotification: () => setNotification(null) };
}
