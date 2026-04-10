import { useMemo } from 'react';
import type { CVData, DesignSettings, ATSScoreResult, KeywordAnalysisResult } from '@/src/shared/types';
import { computeATSScore } from '@/src/features/editor/lib/scoring';
import { computeKeywordAnalysis } from '@/src/features/editor/lib/keywordAnalysis';
import { getCVLanguage } from '@/src/lib/languageDetection';

export interface ATSAnalysisResult {
  score: ATSScoreResult | null;
  keywords: KeywordAnalysisResult;
  hasJobDescription: boolean;
}

const EMPTY_KEYWORDS: KeywordAnalysisResult = {
  keywords: [],
  matchedCount: 0,
  totalCount: 0,
};

/**
 * Hook wrapping computeATSScore + computeKeywordAnalysis.
 * Recomputes via useMemo when inputs change (no debounce -- scoring is < 5ms).
 * When aiKeywords are provided (from IA extraction), they replace NLP extraction.
 * Returns null score when cvData is null.
 */
export function useATSAnalysis(
  cvData: CVData | null,
  designSettings: DesignSettings,
  jobDescription: string,
  aiKeywords?: string[],
): ATSAnalysisResult {
  const language = cvData ? getCVLanguage(cvData) : 'fr';
  const hasJobDescription = jobDescription.trim().length > 0;

  const score = useMemo(
    () => (cvData ? computeATSScore(cvData, designSettings, jobDescription) : null),
    [cvData, designSettings, jobDescription],
  );

  const keywords = useMemo(
    () =>
      cvData && hasJobDescription
        ? computeKeywordAnalysis(cvData, jobDescription, language, aiKeywords)
        : EMPTY_KEYWORDS,
    [cvData, jobDescription, language, hasJobDescription, aiKeywords],
  );

  return { score, keywords, hasJobDescription } as const;
}
