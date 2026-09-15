import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { JobRequirement } from '@/src/shared/types';
import { getUserErrorMessage } from '@/src/shared/lib/convexError';
import {
  createRequirementsRequester, requirementsForOffer, requirementsStatus, readCachedRequirements,
  type AnalyzedOffer, type RequirementsStatus,
} from '../lib/jobRequirementsCache';

export interface JobRequirementsState {
  requirements: JobRequirement[];
  status: RequirementsStatus;
  /** Why the last analysis of the offer on screen failed, for the user */
  error: string;
  /**
   * The requirements of `offer` when cached or being analyzed, undefined
   * otherwise: never a new request. "Adapter" waits on it instead of letting
   * the server pay again for an extraction already running.
   */
  pendingRequirementsFor: (offer: string) => Promise<JobRequirement[]> | undefined;
}

const FAILURE_FALLBACK = "L'analyse de l'offre n'a pas abouti.";

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
 * extraction is retried at the next one. A failure is reported as a status and
 * a message: without requirements there is no score, never a local guess.
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
  const requester = useMemo(() => createRequirementsRequester(args => actionRef.current(args)), []);
  const [analyzed, setAnalyzed] = useState<AnalyzedOffer>({ offer: '', requirements: [] });
  const [failure, setFailure] = useState({ offer: '', message: '' });

  useEffect(() => {
    if (!committedOffer.trim()) return;
    const cached = readCachedRequirements(committedOffer);
    if (cached) {
      setAnalyzed({ offer: committedOffer, requirements: cached });
      return;
    }
    setFailure({ offer: '', message: '' });
    let cancelled = false;
    requester.request(committedOffer, accessCode)
      .then(requirements => {
        // A stale response must not overwrite the requirements of a newer offer
        if (!cancelled) setAnalyzed({ offer: committedOffer, requirements });
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailure({ offer: committedOffer, message: getUserErrorMessage(error, FAILURE_FALLBACK) });
      });
    return () => {
      cancelled = true;
    };
  }, [committedOffer, accessCode, commitId, requester]);

  const pendingRequirementsFor = useCallback((offer: string) => requester.pending(offer, accessCode), [requester, accessCode]);

  return useMemo(() => {
    const requirements = requirementsForOffer(liveOffer, analyzed);
    const status = requirementsStatus({ liveOffer, committedOffer, requirements, failedOffer: failure.offer });
    return { requirements, status, error: status === 'failed' ? failure.message : '', pendingRequirementsFor };
  }, [liveOffer, committedOffer, analyzed, failure, pendingRequirementsFor]);
}
