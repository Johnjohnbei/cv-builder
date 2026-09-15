import { useState, useCallback, useMemo } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { CVData, DesignSettings } from '@/src/shared/types';
import { getUserErrorMessage } from '@/src/shared/lib/convexError';
import { withSuggestedPortfolio } from '../lib/portfolioVariants';

export interface UseEditorAIDeps {
  cvData: CVData | null;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  designSettings: DesignSettings;
  jobDescription: string;
  user: unknown;
  isGuest: boolean;
  notify: (args: { message: string; type: 'success' | 'error' }) => void;
  accessCode: string;
}

export interface UseEditorAIResult {
  isOptimizing: boolean;
  isEnriching: boolean;
  /** Rough duration of a rewrite in seconds, from the CV size (same tiers as the dashboard) */
  optimizeEstimate: number;
  /** Full AI rewrite of the CV against the job description */
  optimize: () => Promise<void>;
  /** Detect company stage + business model tags for every experience */
  enrichExperiences: () => Promise<void>;
}

/**
 * The two AI actions driven from the editor sidebar.
 *
 * Both persist their result to the working draft right away (rather than
 * waiting for the debounced auto-save) because they are expensive: losing
 * their output to a refresh would mean paying for the call twice.
 */
export function useEditorAI(deps: UseEditorAIDeps): UseEditorAIResult {
  const {
    cvData, setCvData, designSettings,
    jobDescription, user, isGuest, notify, accessCode,
  } = deps;

  const optimizeCVAction = useAction(api.ai.optimizeCVForPage);
  const enrichExperienceAction = useAction(api.ai.enrichExperienceMeta);
  const storeUser = useMutation(api.users.store);
  const updateLastCV = useMutation(api.users.updateLastGeneratedCV);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  const persist = useCallback((updated: CVData, label: string) => {
    if (user) {
      updateLastCV({ cvData: updated, jobDescription: jobDescription || undefined })
        .catch(e => console.warn(`[${label}] persist failed:`, e));
    } else if (isGuest) {
      localStorage.setItem('guest_last_optimized', JSON.stringify(updated));
    }
  }, [user, isGuest, jobDescription, updateLastCV]);

  const optimize = useCallback(async () => {
    if (!cvData) return;
    setIsOptimizing(true);
    try {
      // A CV rewritten for an offer comes with the portfolio version that offer calls for
      const optimizedData = withSuggestedPortfolio(
        await optimizeCVAction({
          cvData,
          pageLimit: designSettings.pageLimit || 2,
          jobDescription: jobDescription || undefined,
          accessCode,
        }),
        jobDescription,
      );
      setCvData(optimizedData);
      notify({ message: 'CV optimisé avec succès !', type: 'success' });
      if (user) await storeUser();
      persist(optimizedData, 'handleOptimize');
    } catch (error) {
      console.error('Error optimizing CV:', error);
      notify({ message: getUserErrorMessage(error, 'Erreur lors de l\'optimisation du CV.'), type: 'error' });
    } finally {
      setIsOptimizing(false);
    }
  }, [cvData, designSettings.pageLimit, jobDescription, accessCode, optimizeCVAction, setCvData, notify, user, storeUser, persist]);

  const enrichExperiences = useCallback(async () => {
    if (!cvData?.experience || cvData.experience.length === 0) return;
    setIsEnriching(true);
    try {
      const result = await enrichExperienceAction({
        experiences: cvData.experience.map(exp => ({
          company: exp.company,
          position: exp.position,
          intro: exp.intro,
          description: exp.description,
        })),
        accessCode,
      });
      // Merge: only set tags where missing (don't overwrite user edits)
      const updatedExp = cvData.experience.map((exp, i) => {
        const r = result.results[i];
        if (!r) return exp;
        return {
          ...exp,
          companyStage: exp.companyStage || r.stage || undefined,
          companyBusinessModel: exp.companyBusinessModel || r.businessModel || undefined,
        };
      });
      const updated = { ...cvData, experience: updatedExp };
      setCvData(updated);
      persist(updated, 'handleEnrichExperiences');

      const filled = result.results.filter(r => r.stage || r.businessModel).length;
      notify({
        message: filled > 0
          ? `Tags détectés pour ${filled}/${cvData.experience.length} expériences`
          : 'Aucun tag détectable depuis les expériences actuelles',
        type: filled > 0 ? 'success' : 'error',
      });
    } catch (e) {
      console.error('Error enriching experiences:', e);
      notify({ message: getUserErrorMessage(e, 'Erreur lors de la détection des entreprises.'), type: 'error' });
    } finally {
      setIsEnriching(false);
    }
  }, [cvData, accessCode, enrichExperienceAction, setCvData, notify, persist]);

  const optimizeEstimate = useMemo(() => {
    if (!cvData) return 30;
    const size = JSON.stringify(cvData).length;
    return size < 3000 ? 30 : size < 6000 ? 60 : size < 10000 ? 120 : size < 15000 ? 180 : 240;
  }, [cvData]);

  return { isOptimizing, isEnriching, optimizeEstimate, optimize, enrichExperiences };
}
