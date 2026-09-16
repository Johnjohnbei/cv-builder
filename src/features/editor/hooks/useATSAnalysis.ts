import { useCallback, useMemo, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { ATSReport, CVData, DesignSettings, JobRequirement } from '@/src/shared/types';
import { computeATSReport } from '@/src/features/editor/lib/keywordAnalysis';
import { getUserErrorMessage } from '@/src/shared/lib/convexError';
import { readStoredJSON, writeStoredText } from '@/src/shared/lib/storage';

/** Gaps the user said they do not have, per offer: a per-browser convenience, never sent */
const KEY = 'dismissed_gaps';
const MAX_OFFERS = 5;

/**
 * An offer as this list names it: a short fingerprint, not the offer itself.
 * Five offers of 20 000 characters each were ~100 kB in one localStorage key,
 * in an app already fighting the quota for the guest's CV.
 */
export function offerKey(offer: string): string {
  const text = offer.trim();
  if (!text) return '';
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}

export type DismissedGaps = [offer: string, ids: string[]][];

const NO_IDS: string[] = [];

/**
 * Storage is outside the app's control: an entry of another shape is skipped.
 * An entry written before the offers were named by a fingerprint carries the
 * whole offer as its key; it is named again here, so a gap dismissed then is
 * still dismissed now.
 */
export function parseDismissedGaps(raw: unknown): DismissedGaps {
  return Array.isArray(raw)
    ? raw
      .filter((e): e is [string, string[]] =>
        Array.isArray(e) && typeof e[0] === 'string' && Array.isArray(e[1]) && e[1].every(id => typeof id === 'string'))
      .map(([offer, ids]) => [/^[0-9a-z]+-[0-9a-z]+$/.test(offer) ? offer : offerKey(offer), ids])
    : [];
}

/**
 * The gaps dismissed, with `ids` now those of `offer`: its entry comes first,
 * an offer with none left is dropped, and only the last MAX_OFFERS offers are
 * kept (one browser, every offer ever opened otherwise).
 */
export function withDismissed(entries: DismissedGaps, offer: string, ids: string[]): DismissedGaps {
  return [[offer, ids] as [string, string[]], ...entries.filter(([o]) => o !== offer)]
    .filter(([, kept]) => kept.length > 0)
    .slice(0, MAX_OFFERS);
}

export interface UseATSAnalysisDeps {
  cvData: CVData | null;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  designSettings: DesignSettings;
  /** The offer's requirements, sent with a proof so the server does not extract them again */
  requirements: JobRequirement[];
  /** The offer on screen: the gaps dismissed are kept per offer */
  offer: string;
  accessCode: string | undefined;
  notify: (args: { message: string; type: 'success' | 'error' }) => void;
}

export interface ATSAnalysis {
  /** The CV as it is rendered, measured against the offer's requirements */
  report: ATSReport | null;
  /** Ids of the gaps the user does not have, for the offer on screen */
  dismissed: string[];
  dismiss: (id: string) => void;
  restore: (id: string) => void;
  /** Writes a requirement the user says they have, from their proof: true once the CV covers it */
  prove: (requirement: JobRequirement, proof: string) => Promise<boolean>;
  /** The requirement being written, null otherwise */
  provingId: string | null;
}

/**
 * The ATS tab: the report of the CV as it is rendered, recomputed on every edit
 * (a few milliseconds), and the two actions on a gap (plan § 5.2) — "J'ai cette
 * compétence" writes the requirement from the user's proof, checked by the same
 * truth guard as the tailoring; "Je ne l'ai pas" takes the gap out of the
 * reminder, the score unchanged.
 *
 * The report is null until the CV is loaded. Without requirements (no offer, or
 * its analysis not available) it carries no score, only the readability checks.
 */
export function useATSAnalysis(deps: UseATSAnalysisDeps): ATSAnalysis {
  const { cvData, setCvData, designSettings, requirements, offer, accessCode, notify } = deps;
  const proveAction = useAction(api.ai.proveRequirement);
  const [entries, setEntries] = useState(() => parseDismissedGaps(readStoredJSON<unknown>(KEY, [])));
  const [provingId, setProvingId] = useState<string | null>(null);
  const key = offerKey(offer);
  const dismissed = entries.find(([o]) => o === key)?.[1] ?? NO_IDS;

  const report = useMemo(
    () => (cvData ? computeATSReport(cvData, requirements, { design: designSettings }) : null),
    [cvData, designSettings, requirements],
  );

  const setDismissed = useCallback((ids: string[]) => {
    const next = withDismissed(entries, key, ids);
    setEntries(next);
    // Refused (quota, private mode): kept for this visit only
    writeStoredText(KEY, JSON.stringify(next));
  }, [entries, key]);

  const dismiss = useCallback((id: string) => setDismissed([...dismissed.filter(d => d !== id), id]), [dismissed, setDismissed]);
  const restore = useCallback((id: string) => setDismissed(dismissed.filter(d => d !== id)), [dismissed, setDismissed]);

  const prove = useCallback(async (requirement: JobRequirement, proof: string) => {
    if (!cvData) return false;
    setProvingId(requirement.id);
    try {
      const result = await proveAction({ cvData, jobDescription: offer, requirements, requirementId: requirement.id, proof, accessCode });
      // The CV is replaced only when the server wrote something: a failed
      // placement used to change the CV while telling the user nothing happened
      if (result.written) setCvData(result.cv);
      notify(result.written
        ? { message: `« ${requirement.label} » ajouté au CV.`, type: 'success' }
        : { message: `« ${requirement.label} » n'a pas pu être placé : précisez où vous l'avez mis en œuvre, chez quel employeur.`, type: 'error' });
      return result.written;
    } catch (error) {
      console.error('Error proving requirement:', error);
      notify({ message: getUserErrorMessage(error, "Erreur lors de l'ajout au CV."), type: 'error' });
      return false;
    } finally {
      setProvingId(null);
    }
  }, [cvData, offer, requirements, accessCode, proveAction, setCvData, notify]);

  return { report, dismissed, dismiss, restore, prove, provingId };
}
