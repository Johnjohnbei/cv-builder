import { useMemo } from 'react';
import type { ATSReport, CVData, DesignSettings, JobRequirement } from '@/src/shared/types';
import { computeATSReport } from '@/src/features/editor/lib/keywordAnalysis';

/**
 * The ATS report of the CV as it is rendered, against the offer's requirements.
 * Recomputed on every edit (a few milliseconds); null until the CV is loaded.
 * Without requirements (no offer, or its analysis not available) the report
 * carries no score, only the readability checks.
 */
export function useATSAnalysis(
  cvData: CVData | null,
  designSettings: DesignSettings,
  requirements: JobRequirement[],
): ATSReport | null {
  return useMemo(
    () => (cvData ? computeATSReport(cvData, requirements, { design: designSettings }) : null),
    [cvData, designSettings, requirements],
  );
}
