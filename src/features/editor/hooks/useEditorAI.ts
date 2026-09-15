import { useState, useCallback, useMemo } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { CVData, DesignSettings } from '@/src/shared/types';
import { getUserErrorMessage } from '@/src/shared/lib/convexError';
import { STORAGE_FAILED_MESSAGE, writeStoredText } from '@/src/shared/lib/storage';
import { withSuggestedPortfolio } from '../lib/portfolioVariants';
import { readCachedRequirements, writeCachedRequirements } from '../lib/jobRequirementsCache';

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
  /** The CV tailored to the job description by the verified pipeline */
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

  const tailorAction = useAction(api.ai.tailorCV);
  const enrichExperienceAction = useAction(api.ai.enrichExperienceMeta);
  const storeUser = useMutation(api.users.store);
  const updateLastCV = useMutation(api.users.updateLastGeneratedCV);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  const persist = useCallback((updated: CVData, label: string) => {
    if (user) {
      updateLastCV({ cvData: updated, jobDescription })
        .catch(e => console.warn(`[${label}] persist failed:`, e));
    } else if (isGuest) {
      if (!writeStoredText('guest_last_optimized', JSON.stringify(updated))) {
        notify({ message: STORAGE_FAILED_MESSAGE, type: 'error' });
      }
    }
  }, [user, isGuest, jobDescription, updateLastCV, notify]);

  const optimize = useCallback(async () => {
    if (!cvData || !jobDescription.trim()) return;
    setIsOptimizing(true);
    try {
      const result = await tailorAction({
        baseData: cvData,
        jobDescription,
        pageLimit: designSettings.pageLimit || 2,
        // Already paid for by the ATS tab: the server checks them again
        requirements: readCachedRequirements(jobDescription) ?? undefined,
        accessCode,
      });
      writeCachedRequirements(jobDescription, result.requirements);
      // A CV rewritten for an offer comes with the portfolio version that offer calls for
      const optimizedData = withSuggestedPortfolio(result.cv, jobDescription);
      setCvData(optimizedData);
      notify({ message: "CV adapté à l'offre.", type: 'success' });
      if (user) await storeUser();
      persist(optimizedData, 'handleOptimize');
    } catch (error) {
      console.error('Error optimizing CV:', error);
      notify({ message: getUserErrorMessage(error, "Erreur lors de l'adaptation du CV."), type: 'error' });
    } finally {
      setIsOptimizing(false);
    }
  }, [cvData, designSettings.pageLimit, jobDescription, accessCode, tailorAction, setCvData, notify, user, storeUser, persist]);

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
