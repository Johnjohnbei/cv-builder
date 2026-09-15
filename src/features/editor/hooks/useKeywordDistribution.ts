import { useCallback, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { CVData } from '@/src/shared/types';
import { getCVLanguage } from '@/src/lib/languageDetection';
import { getUserErrorMessage } from '@/src/shared/lib/convexError';
import { applyRewriteToCV, locateBullet } from './useBulletOptimization';

// ─── Types ───

export interface DistributionProposal {
  keyword: string;
  expIndex: number | null;
  bulletIndex: number | null;
  originalBullet: string | null;
  rewrittenBullet: string | null;
  reason: string;
  expLabel: string;
}

export interface UseKeywordDistributionDeps {
  cvData: CVData | null;
  setCvData: (updater: (prev: CVData | null) => CVData | null) => void;
  jobDescription: string;
  missingKeywords: string[];
  notify: (args: { message: string; type: 'success' | 'error' }) => void;
  accessCode?: string;
}

export interface UseKeywordDistributionResult {
  proposals: DistributionProposal[];
  isDistributing: boolean;
  distribute: () => Promise<void>;
  acceptOne: (keyword: string) => void;
  rejectOne: (keyword: string) => void;
  acceptAll: () => void;
  rejectAll: () => void;
}

// ─── Helpers ───

/**
 * Strip non-content (design + language) fields from a CV for AI prompts.
 * Returns a fresh object — no mutation, no unused-var hack.
 * Exported for unit testing.
 */
export function stripNonContent(cvData: CVData) {
  return {
    personal_info: cvData.personal_info,
    experience: cvData.experience,
    education: cvData.education,
    skills: cvData.skills,
    languages: cvData.languages,
  };
}

/**
 * Apply a list of assignments to an experience array. Immutable.
 *
 * Proposals point at (expIndex, bulletIndex) as they were when the AI
 * answered; the user may have reordered or edited experiences since. When the
 * original text is known the rewrite follows it, and a bullet that no longer
 * exists is skipped instead of overwriting whatever now sits at that index.
 * Exported for unit testing.
 */
export function applyAssignments(
  experience: CVData['experience'],
  proposals: DistributionProposal[],
): CVData['experience'] {
  return proposals.reduce((next, p) => {
    if (p.expIndex === null || p.bulletIndex === null || p.rewrittenBullet === null) return next;
    const target = p.originalBullet === null
      ? { expIndex: p.expIndex, bulletIndex: p.bulletIndex }
      : locateBullet(next, p.expIndex, p.bulletIndex, p.originalBullet);
    return target ? applyRewriteToCV(next, target.expIndex, target.bulletIndex, p.rewrittenBullet) : next;
  }, experience);
}

// ─── Hook ───

/**
 * Owns the auto-distribute keyword flow: state, AI call, accept/reject logic.
 * Consumers pass the current CV + setter and receive a ready-to-render set of
 * handlers. Extracted from EditorPage to keep the page thin and make the flow
 * testable in isolation.
 */
export function useKeywordDistribution(
  deps: UseKeywordDistributionDeps,
): UseKeywordDistributionResult {
  const { cvData, setCvData, jobDescription, missingKeywords, notify, accessCode } = deps;
  const language = cvData ? getCVLanguage(cvData) : 'fr';
  const distributeAction = useAction(api.ai.autoDistributeMissingKeywords);
  const [proposals, setProposals] = useState<DistributionProposal[]>([]);
  const [isDistributing, setIsDistributing] = useState(false);

  const distribute = useCallback(async () => {
    if (!cvData || !jobDescription || missingKeywords.length === 0) return;
    setIsDistributing(true);
    try {
      const data = await distributeAction({
        cvData: stripNonContent(cvData),
        missingKeywords,
        jobDescription,
        language,
        accessCode,
      });
      const mapped: DistributionProposal[] = data.assignments.map((a) => {
        const exp = a.expIndex != null ? cvData.experience[a.expIndex] : null;
        const expLabel = exp ? `${exp.position} @ ${exp.company}` : 'Non assigné';
        return {
          keyword: a.keyword,
          expIndex: a.expIndex,
          bulletIndex: a.bulletIndex ?? null,
          // The real text, not the model's echo of it: accepting relocates by text
          originalBullet: (exp && a.bulletIndex != null ? exp.description[a.bulletIndex] : undefined)
            ?? a.originalBullet ?? null,
          rewrittenBullet: a.rewrittenBullet ?? null,
          reason: a.reason ?? '',
          expLabel,
        };
      });
      setProposals(mapped);
      notify({
        message: `${mapped.length} proposition(s) générée(s)`,
        type: 'success',
      });
    } catch (e) {
      notify({
        message: getUserErrorMessage(e, 'Erreur lors de la distribution automatique'),
        type: 'error',
      });
    } finally {
      setIsDistributing(false);
    }
  }, [cvData, jobDescription, missingKeywords, language, distributeAction, notify, accessCode]);

  const acceptOne = useCallback(
    (keyword: string) => {
      const proposal = proposals.find((p) => p.keyword === keyword);
      if (!proposal || !cvData) return;
      if (proposal.rewrittenBullet !== null && applyAssignments(cvData.experience, [proposal]) === cvData.experience) {
        notify({ message: 'Ce point a été modifié entre-temps : la proposition est ignorée.', type: 'error' });
      } else {
        setCvData((prev) => (prev ? { ...prev, experience: applyAssignments(prev.experience, [proposal]) } : null));
      }
      setProposals((prev) => prev.filter((p) => p.keyword !== keyword));
    },
    [proposals, cvData, setCvData, notify],
  );

  const rejectOne = useCallback((keyword: string) => {
    setProposals((prev) => prev.filter((p) => p.keyword !== keyword));
  }, []);

  const acceptAll = useCallback(() => {
    setCvData((prev) => (prev ? { ...prev, experience: applyAssignments(prev.experience, proposals) } : null));
    setProposals([]);
  }, [proposals, setCvData]);

  const rejectAll = useCallback(() => {
    setProposals([]);
  }, []);

  return { proposals, isDistributing, distribute, acceptOne, rejectOne, acceptAll, rejectAll };
}
