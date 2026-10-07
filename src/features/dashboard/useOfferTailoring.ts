import { useEffect, useRef, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { CVData } from '@/src/shared/types';
import { attachBilingualCache } from '@/src/lib/bilingual';
import { withSuggestedPortfolio } from '@/src/features/editor/lib/portfolio-variants';
import { requestRequirements, writeCachedRequirements } from '@/src/features/editor/lib/job-requirements-cache';
import { dismissedGapsOf } from '@/src/features/editor/hooks/useATSAnalysis';

interface Deps {
  baseCV: CVData | null;
  offer: string;
  getCode: () => string | undefined;
  reportAIError: (error: unknown, fallback: string) => void;
  /** Stores the CV as the working draft: false when it could not, the user told why */
  saveDraft: (cvData: CVData) => Promise<boolean>;
  /** Opens the editor once the CV is stored: its ATS tab measures the CV as it prints */
  onTailored: () => void;
}

/**
 * The dashboard's tailoring, from A to Z with no question asked (arbitrage of
 * 2026-10-07): the offer is analyzed, then ONE generation writes every
 * requirement it may, except those the user dismissed in the editor's ATS tab
 * ("je ne l'ai pas"). What is left to prove, that tab still takes.
 */
export function useOfferTailoring({ baseCV, offer, getCode, reportAIError, saveDraft, onTailored }: Deps) {
  const extractAction = useAction(api.ai.extractJobRequirements);
  const tailorCV = useAction(api.ai.tailorCV);
  const translateCV = useAction(api.ai.translateCV);
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'generating'>('idle');
  /**
   * The run each answer belongs to. A run left behind (the offer changed, the
   * page closed) must not store its CV or open the editor: its paid answer is
   * dropped.
   */
  const runRef = useRef(0);
  useEffect(() => () => { runRef.current += 1; }, []);

  const reset = () => { runRef.current += 1; setPhase('idle'); };

  const start = async () => {
    if (!baseCV || !offer) return;
    reset();
    const run = runRef.current;
    const current = () => run === runRef.current;
    setPhase('analyzing');
    let analyzed = false;
    try {
      const accessCode = getCode();
      const known = await requestRequirements(offer, accessCode, args => extractAction(args));
      if (!current()) return;
      analyzed = true;
      setPhase('generating');
      const result = await tailorCV({ baseData: baseCV, jobDescription: offer, requirements: known, excluded: dismissedGapsOf(offer), accessCode });
      if (!current()) return;
      writeCachedRequirements(offer, result.requirements);
      // A CV proposed for an offer comes with the portfolio version that offer calls for.
      // Both languages now, so the editor toggle never shows a half-translated mix.
      const cvData = await attachBilingualCache(withSuggestedPortfolio(result.cv, offer), translateCV, accessCode);
      if (!current()) return;
      const saved = await saveDraft(cvData);
      if (!current()) return;
      reset();
      if (saved) onTailored();
    } catch (error) {
      if (!current()) return;
      console.error(analyzed ? 'Optimization error:' : 'Offer analysis error:', error);
      reportAIError(error, analyzed
        ? "Erreur lors de l'optimisation du CV. Veuillez réessayer."
        : "L'analyse de l'offre n'a pas abouti. Veuillez réessayer.");
      setPhase('idle');
    }
  };

  return { phase, start, reset };
}
