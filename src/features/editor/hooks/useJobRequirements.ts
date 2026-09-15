import { useEffect, useMemo, useRef, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { JobRequirement } from '@/src/shared/types';
import {
  requirementsForOffer, readCachedRequirements, writeCachedRequirements, type AnalyzedOffer,
} from '../lib/jobRequirementsCache';

/**
 * idle: no offer. loading: the offer is being analyzed, or not committed yet.
 * ready: requirements known. failed: the last analysis of this offer failed.
 */
export type RequirementsStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface JobRequirementsState {
  requirements: JobRequirement[];
  status: RequirementsStatus;
}

/**
 * LLM-extracted requirements of the committed offer, applied to the offer on screen.
 *
 * `committedOffer` is the offer as last committed (on load, and when the offer
 * field loses focus), never the live text: each call is billed and uses up the
 * access code, and a pause while typing is not a finished offer. Firing on the
 * empty-to-filled transition only left an offer typed in the field without
 * requirements; firing at each 1.5 s pause billed every retouch and made the
 * ATS score jump while typing. The cache covers an offer that comes back.
 *
 * Requirements are stored with the offer they were extracted from and returned
 * only while `liveOffer` is that offer: edited or replaced text must never be
 * scored against another offer's requirements, not even for one render.
 *
 * `commitId` changes at every commit, same text included, so a failed
 * extraction is retried at the next one. A failure is reported as a status:
 * without requirements there is no score, never a local guess.
 */
export function useJobRequirements(
  committedOffer: string,
  liveOffer: string,
  accessCode: string | undefined,
  commitId: number,
): JobRequirementsState {
  const extractAction = useAction(api.ai.extractJobRequirements);
  // Read through a ref so a new function identity never re-triggers a paid call
  const actionRef = useRef(extractAction);
  actionRef.current = extractAction;
  // Requests in flight, one per offer and code, shared by every run of the
  // effect: the StrictMode remount sent a second call, and so did going back
  // to an offer whose answer had not arrived yet.
  const inflight = useRef(new Map<string, ReturnType<typeof extractAction>>());
  const [analyzed, setAnalyzed] = useState<AnalyzedOffer>({ offer: '', requirements: [] });
  const [failedOffer, setFailedOffer] = useState('');

  useEffect(() => {
    if (!committedOffer.trim()) return;
    const cached = readCachedRequirements(committedOffer);
    if (cached) {
      setAnalyzed({ offer: committedOffer, requirements: cached });
      return;
    }
    setFailedOffer('');
    const key = JSON.stringify([committedOffer.trim(), accessCode ?? '']);
    let request = inflight.current.get(key);
    if (!request) {
      request = actionRef.current({ jobDescription: committedOffer, accessCode });
      inflight.current.set(key, request);
      request
        // Cached even when superseded or unmounted: the call is paid, and the
        // offer may come back (reload, return from the dashboard)
        .then(data => { if (Array.isArray(data.requirements)) writeCachedRequirements(committedOffer, data.requirements); })
        .catch(() => {})
        // Settled: the cache answers from now on, and a failure is retried at the next commit
        .finally(() => inflight.current.delete(key));
    }

    let cancelled = false;
    request
      .then(data => {
        // A stale response must not overwrite the requirements of a newer offer
        if (!cancelled && Array.isArray(data.requirements)) setAnalyzed({ offer: committedOffer, requirements: data.requirements });
      })
      .catch(() => { if (!cancelled) setFailedOffer(committedOffer); });
    return () => {
      cancelled = true;
    };
  }, [committedOffer, accessCode, commitId]);

  return useMemo(() => {
    const requirements = requirementsForOffer(liveOffer, analyzed);
    const status: RequirementsStatus = !liveOffer.trim()
      ? 'idle'
      : requirements.length > 0
        ? 'ready'
        : failedOffer.trim() === liveOffer.trim() ? 'failed' : 'loading';
    return { requirements, status };
  }, [liveOffer, analyzed, failedOffer]);
}
