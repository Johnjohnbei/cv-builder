import { useCallback, useEffect, useRef, useState } from 'react';
import type { CVData, JobRequirement } from '@/src/shared/types';
import { condenseOneStep, expandToMax, maxCondenseSteps } from '../lib/fitToPages';

export interface UseFitToPagesDeps {
  cvData: CVData | null;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  /** The offer's requirements: drive which roles keep their detail */
  requirements: JobRequirement[];
  /**
   * False while the offer's requirements are still expected: fitting a fresh
   * CV then would rank every experience on recency alone, and a fitted CV is
   * not fitted again.
   */
  requirementsReady: boolean;
  /**
   * Page count for the current content once measurement converged, null while
   * it is still being measured. Never substitute the raw actualPageCount here:
   * acting on a mid-reconcile estimate condenses several notches too far.
   */
  stablePageCount: number | null;
  targetPages: number;
  /** Job description stored with the CV, '' when there is none */
  loadedJobDescription: string;
  /** Job description currently in state — lags loadedJobDescription by a render */
  jobDescription: string;
  notify: (args: { message: string; type: 'success' | 'error' }) => void;
}

export interface UseFitToPagesResult {
  /** True while the loop is condensing — disables the button, shows a spinner */
  isFitting: boolean;
  /** Re-expand every experience to full detail, then condense down to target */
  runFit: () => void;
}

/**
 * Drive fitToPages against the live pagination engine.
 *
 * One notch per render pass: condense the weakest experience, let
 * usePaginationFit re-measure the real DOM, read the new page count, repeat.
 * Measuring is what makes this honest — a heuristic "this experience is worth
 * 3 lines" would drift the moment the template, font or wording changed.
 *
 * Deliberately NOT continuous: it runs on a fresh CV and when the user asks.
 * A permanent loop would silently shrink one experience because the user just
 * expanded another, which is the manual triage they wanted to stop doing.
 */
export function useFitToPages(deps: UseFitToPagesDeps): UseFitToPagesResult {
  const {
    cvData, setCvData, requirements, requirementsReady, stablePageCount, targetPages,
    loadedJobDescription, jobDescription, notify,
  } = deps;

  const [isFitting, setIsFitting] = useState(false);
  const stepsRef = useRef(0);
  // Read inside the effect without making it a dependency: re-running the loop
  // on every requirements identity change would fight the user.
  const requirementsRef = useRef(requirements);
  requirementsRef.current = requirements;

  const runFit = useCallback(() => {
    if (!cvData?.experience?.length) return;
    stepsRef.current = 0;
    setIsFitting(true);
    setCvData(prev => (prev ? { ...prev, experience: expandToMax(prev.experience) } : prev));
  }, [cvData?.experience?.length, setCvData]);

  // "No experience carries a display mode" means this CV has never been
  // triaged: a fresh import, or a rewrite the AI just returned. Fit it, so what
  // the user sees always respects the page budget without asking.
  //
  // Derived from the data rather than latched behind a one-shot ref, because
  // the condition must fire again after an AI rewrite — and it cannot loop:
  // runFit() assigns a mode to every experience, which makes it false.
  // A manually trimmed CV keeps its modes and is therefore never touched.
  useEffect(() => {
    if (isFitting || !cvData?.experience?.length) return;
    if (cvData.experience.some(exp => exp.displayMode)) return;
    // Wait for the stored job description to reach state, otherwise the pass
    // would rank every experience against an empty offer.
    if (loadedJobDescription && !jobDescription) return;
    if (!requirementsReady) return;
    runFit();
  }, [cvData, isFitting, loadedJobDescription, jobDescription, requirementsReady, runFit]);

  useEffect(() => {
    if (!isFitting || stablePageCount === null || !cvData?.experience?.length) return;

    // Already within budget: stop at the FIRST state that fits. Coming down
    // from full detail one notch at a time, that state is also the richest one
    // that fits — another notch would waste page space the user may use.
    if (stablePageCount <= targetPages) {
      setIsFitting(false);
      return;
    }

    const exhausted = stepsRef.current >= maxCondenseSteps(cvData.experience);
    const next = exhausted ? null : condenseOneStep(cvData.experience, requirementsRef.current);
    if (!next) {
      setIsFitting(false);
      notify({
        message: `CV sur ${stablePageCount} pages : plus rien à condenser sans supprimer du contenu.`,
        type: 'error',
      });
      return;
    }

    stepsRef.current += 1;
    setCvData(prev => (prev ? { ...prev, experience: next } : prev));
  }, [isFitting, stablePageCount, targetPages, cvData, setCvData, notify]);

  return { isFitting, runFit };
}
