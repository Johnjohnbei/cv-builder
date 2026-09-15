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
