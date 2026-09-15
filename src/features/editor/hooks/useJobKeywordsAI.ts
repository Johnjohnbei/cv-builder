import { useEffect, useRef, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { readCachedKeywords, writeCachedKeywords } from '../lib/aiKeywordCache';

/** Wait for the offer to stop changing before paying for an extraction */
const DEBOUNCE_MS = 1_500;

/**
 * LLM-extracted keywords for the current job description.
 *
 * Runs once the offer has been stable for DEBOUNCE_MS, and reuses the cache
 * when the same offer comes back: an unchanged input does not deserve a
 * second LLM call.
 *
 * It used to fire only on the transition from "no offer" to "an offer": an
 * offer typed or edited in the field sent its first character to the model,
 * was cancelled at the next keystroke, and never got AI keywords at all.
 *
 * Failures are silent by design: the ATS panel falls back to the local NLP
 * extraction, which is worse but never blocks the user.
 */
export function useJobKeywordsAI(jobDescription: string, accessCode?: string): string[] {
  const extractKeywordsAction = useAction(api.ai.extractJobKeywords);
  // Read through a ref so a new function identity never re-triggers a paid call
  const actionRef = useRef(extractKeywordsAction);
  actionRef.current = extractKeywordsAction;
  const [aiKeywords, setAiKeywords] = useState<string[]>([]);

  useEffect(() => {
    if (!jobDescription.trim()) {
      setAiKeywords([]);
      return;
    }
    const cached = readCachedKeywords(jobDescription);
    if (cached) {
      setAiKeywords(cached);
      return;
    }
    // Keywords of the previous offer must not describe this one
    setAiKeywords([]);

    // Cancelled if the offer changes again or the page unmounts, so a stale
    // response can't overwrite a fresher one.
    let cancelled = false;
    const timer = setTimeout(() => {
      actionRef.current({ jobDescription, accessCode })
        .then(data => {
          if (!cancelled && Array.isArray(data.keywords)) {
            setAiKeywords(data.keywords);
            writeCachedKeywords(jobDescription, data.keywords);
          }
        })
        .catch(() => {}); // Falls back to NLP extraction silently
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobDescription, accessCode]);

  return aiKeywords;
}
