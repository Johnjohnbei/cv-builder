import { useEffect } from 'react';

const BASE_TITLE = 'Calibre';

/** Set the document title. Resets to base title on unmount. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE_TITLE}` : BASE_TITLE;
    return () => { document.title = BASE_TITLE; };
  }, [title]);
}
