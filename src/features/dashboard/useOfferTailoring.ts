import { useEffect, useRef, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { saysWhere, type CVData, type JobRequirement } from '@/src/shared/types';
import { attachBilingualCache } from '@/src/lib/bilingual';
import { withSuggestedPortfolio } from '@/src/features/editor/lib/portfolio-variants';
import { requestRequirements, writeCachedRequirements } from '@/src/features/editor/lib/job-requirements-cache';
import { isProvable } from '@/src/features/editor/lib/keyword-analysis';
import { useDismissedGaps } from '@/src/features/editor/hooks/useATSAnalysis';

/** What the CV does not prove of the offer, asked before the one generation */
export interface OfferGaps {
  requirements: JobRequirement[];
  evidence: { id: string; quote: string }[];
  /** Requirements a proof can write */
  provable: JobRequirement[];
  /** A degree, a language, years, a title: written in the Contenu tab, never by a rewrite */
  factual: JobRequirement[];
}

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
 * The dashboard's tailoring (plan of 2026-09-17, lot D): the offer is analyzed
 * and the CV read against it first, the candidate says where they put in
 * practice what the CV does not prove, then ONE generation writes it all.
 * Asked after, each proof was a call of its own and the first score was low.
 */
export function useOfferTailoring({ baseCV, offer, getCode, reportAIError, saveDraft, onTailored }: Deps) {
  const extractAction = useAction(api.ai.extractJobRequirements);
  const analyzeGaps = useAction(api.ai.analyzeGaps);
  const tailorCV = useAction(api.ai.tailorCV);
  const translateCV = useAction(api.ai.translateCV);
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'asking' | 'generating'>('idle');
  const [gaps, setGaps] = useState<OfferGaps | null>(null);
  /** The candidate was asked: the panel stays on screen while the CV is written */
  const [asked, setAsked] = useState(false);
  const [proofs, setProofs] = useState<Record<string, string>>({});
  const { dismissed, dismiss, restore } = useDismissedGaps(offer);
  /**
   * The run each answer belongs to. A run left behind (the offer changed, the
   * page closed) must not show its questions next to another offer, store its
   * CV or open the editor: its paid answer is dropped.
   */
  const runRef = useRef(0);
  useEffect(() => () => { runRef.current += 1; }, []);

  const reset = () => { runRef.current += 1; setPhase('idle'); setGaps(null); setAsked(false); setProofs({}); };

  const generate = async (analysis: OfferGaps, answers: Record<string, string>, wasAsked: boolean) => {
    if (!baseCV) return;
    const run = runRef.current;
    const current = () => run === runRef.current;
    setPhase('generating');
    try {
      const accessCode = getCode();
      const given = Object.entries(answers)
        .filter(([id, text]) => !dismissed.includes(id) && saysWhere(text))
        .map(([id, text]) => ({ id, text: text.trim() }));
      const result = await tailorCV({
        baseData: baseCV, jobDescription: offer, requirements: analysis.requirements,
        evidence: analysis.evidence, proofs: given, accessCode,
      });
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
      console.error('Optimization error:', error);
      reportAIError(error, "Erreur lors de l'optimisation du CV. Veuillez réessayer.");
      // The answers typed are kept for another try; with nothing asked, back to the offer
      setPhase(wasAsked ? 'asking' : 'idle');
    }
  };

  /** Analyze the offer and the CV; ask only when a proof could raise the score */
  const start = async () => {
    if (!baseCV || !offer) return;
    reset();
    const run = runRef.current;
    setPhase('analyzing');
    try {
      const accessCode = getCode();
      const known = await requestRequirements(offer, accessCode, args => extractAction(args));
      const read = await analyzeGaps({ baseData: baseCV, jobDescription: offer, requirements: known, accessCode });
      if (run !== runRef.current) return;
      writeCachedRequirements(offer, read.requirements);
      const missing = read.requirements.filter(r => read.gaps.includes(r.id));
      const analysis: OfferGaps = {
        requirements: read.requirements,
        evidence: read.evidence,
        provable: missing.filter(isProvable),
        factual: missing.filter(r => !isProvable(r)),
      };
      setGaps(analysis);
      if (analysis.provable.some(r => !dismissed.includes(r.id))) {
        setAsked(true);
        setPhase('asking');
      } else {
        await generate(analysis, {}, false);
      }
    } catch (error) {
      if (run !== runRef.current) return;
      console.error('Offer analysis error:', error);
      reportAIError(error, "L'analyse de l'offre n'a pas abouti. Veuillez réessayer.");
      setPhase('idle');
    }
  };

  const setProof = (id: string, text: string) => setProofs(current => ({ ...current, [id]: text }));
  /** A proof started but too short to say where: the server would drop it without a word */
  const tooShort = Object.entries(proofs).filter(([id, text]) => !dismissed.includes(id) && text.trim() && !saysWhere(text)).map(([id]) => id);

  return {
    phase, gaps, asked, proofs, setProof, tooShort, dismissed, dismiss, restore, start, reset,
    confirm: () => { if (gaps) void generate(gaps, proofs, true); },
  };
}
