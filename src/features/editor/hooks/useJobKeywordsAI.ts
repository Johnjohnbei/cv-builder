import { useEffect, useRef, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { readCachedKeywords, writeCachedKeywords } from '../lib/aiKeywordCache';

/**
 * LLM-extracted keywords for the current job description.
 *
 * Fires once per transition from "no offer" to "an offer", not on every
 * keystroke, and reuses the cache when the same offer comes back — an
 * unchanged input does not deserve a second LLM call.
 *
 * Failures are silent by design: the ATS panel falls back to the local NLP
 * extraction, which is worse but never blocks the user.
 */
export function useJobKeywordsAI(jobDescription: string, accessCode?: string): string[] {
  const extractKeywordsAction = useAction(api.ai.extractJobKeywords);
  const [aiKeywords, setAiKeywords] = useState<string[]>([]);
  const prevJDRef = useRef(jobDescription);

  useEffect(() => {
    const wasEmpty = !prevJDRef.current.trim();
    const isNowFilled = jobDescription.trim().length > 0;
    prevJDRef.current = jobDescription;
    if (!wasEmpty || !isNowFilled) return;

    const cached = readCachedKeywords(jobDescription);
    if (cached) {
      setAiKeywords(cached);
      return;
    }

    // Cancelled if the offer changes again or the page unmounts, so a stale
    // response can't overwrite a fresher one.
    let cancelled = false;
    extractKeywordsAction({ jobDescription, accessCode })
      .then(data => {
        if (!cancelled && Array.isArray(data.keywords)) {
          setAiKeywords(data.keywords);
          writeCachedKeywords(jobDescription, data.keywords);
        }
      })
      .catch(() => {}); // Falls back to NLP extraction silently
    return () => { cancelled = true; };
  }, [jobDescription]);

  return aiKeywords;
}
