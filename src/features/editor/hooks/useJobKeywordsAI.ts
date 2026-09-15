import { useEffect, useMemo, useRef, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  keywordsForOffer, readCachedKeywords, writeCachedKeywords, type AnalyzedOffer,
} from '../lib/aiKeywordCache';

/**
 * LLM-extracted keywords of the committed offer, applied to the offer on screen.
 *
 * `committedOffer` is the offer as last committed (on load, and when the offer
 * field loses focus), never the live text: each call is billed and uses up the
 * access code, and a pause while typing is not a finished offer. Firing on the
 * empty-to-filled transition only left an offer typed in the field without
 * keywords; firing at each 1.5 s pause billed every retouch and made the ATS
 * score jump while typing. The cache covers an offer that comes back.
 *
 * Keywords are stored with the offer they were extracted from and returned
 * only while `liveOffer` is that offer: edited or replaced text must never be
 * scored against another offer's keywords, not even for one render.
 *
 * `commitId` changes at every commit, same text included, so a failed
 * extraction is retried at the next one.
 *
 * Failures are silent by design: the ATS panel falls back to the local NLP
 * extraction, which is worse but never blocks the user.
 */
export function useJobKeywordsAI(
  committedOffer: string,
  liveOffer: string,
  accessCode: string | undefined,
  commitId: number,
): string[] {
  const extractKeywordsAction = useAction(api.ai.extractJobKeywords);
  // Read through a ref so a new function identity never re-triggers a paid call
  const actionRef = useRef(extractKeywordsAction);
  actionRef.current = extractKeywordsAction;
  // Requests in flight, one per offer and code, shared by every run of the
  // effect: the StrictMode remount sent a second call, and so did going back
  // to an offer whose answer had not arrived yet.
  const inflight = useRef(new Map<string, ReturnType<typeof extractKeywordsAction>>());
  const [analyzed, setAnalyzed] = useState<AnalyzedOffer>({ offer: '', keywords: [] });

  useEffect(() => {
    if (!committedOffer.trim()) return;
    const cached = readCachedKeywords(committedOffer);
    if (cached) {
      setAnalyzed({ offer: committedOffer, keywords: cached });
      return;
    }
    const key = JSON.stringify([committedOffer.trim(), accessCode ?? '']);
    let request = inflight.current.get(key);
    if (!request) {
      request = actionRef.current({ jobDescription: committedOffer, accessCode });
      inflight.current.set(key, request);
      request
        // Cached even when superseded or unmounted: the call is paid, and the
        // offer may come back (reload, return from the dashboard)
        .then(data => { if (Array.isArray(data.keywords)) writeCachedKeywords(committedOffer, data.keywords); })
        .catch(() => {})
        // Settled: the cache answers from now on, and a failure is retried at the next commit
        .finally(() => inflight.current.delete(key));
    }

    let cancelled = false;
    request
      .then(data => {
        // A stale response must not overwrite the keywords of a newer offer
        if (!cancelled && Array.isArray(data.keywords)) setAnalyzed({ offer: committedOffer, keywords: data.keywords });
      })
      .catch(() => {}); // Falls back to NLP extraction silently
    return () => {
      cancelled = true;
    };
  }, [committedOffer, accessCode, commitId]);

  return useMemo(() => keywordsForOffer(liveOffer, analyzed), [liveOffer, analyzed]);
}
