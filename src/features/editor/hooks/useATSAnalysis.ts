import { useCallback, useMemo } from 'react';
import type { ATSReport, CVData, DesignSettings, DismissedRequirement, JobRequirement } from '@/src/shared/types';
import { computeATSReport } from '@/src/features/editor/lib/keyword-analysis';
import { dismissedOf, withDismissed, withRestored } from '@/src/features/editor/lib/dismissed-requirements';

export interface UseATSAnalysisDeps {
  /** The CV as the user wrote it: dismissing writes on it */
  cvData: CVData | null;
  /** The CV as it prints (`withoutDismissed`): the one measured */
  printedCV: CVData | null;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  designSettings: DesignSettings;
  requirements: JobRequirement[];
}

export interface ATSAnalysis {
  /** The CV as it prints, measured against the offer's requirements */
  report: ATSReport | null;
  /**
   * The requirements the user said they lack, as the CV keeps them: listed
   * whatever offer is on screen, so each one can always be put back
   */
  dismissed: DismissedRequirement[];
  dismiss: (requirement: JobRequirement) => void;
  restore: (id: string) => void;
}

/**
 * The ATS tab: the report of the CV as it prints, recomputed on every edit (a
 * few milliseconds), and the one action on a gap, no AI call (arbitrage of
 * 2026-10-07): "Je ne l'ai pas" takes the requirement out of the CV as it
 * prints, "Remettre" puts it back.
 *
 * The report is null until the CV is loaded. Without requirements (no offer, or
 * its analysis not available) it carries no score, only the readability checks.
 */
export function useATSAnalysis({ cvData, printedCV, setCvData, designSettings, requirements }: UseATSAnalysisDeps): ATSAnalysis {
  const report = useMemo(
    () => (printedCV ? computeATSReport(printedCV, requirements, { design: designSettings }) : null),
    [printedCV, designSettings, requirements],
  );
  const dismissed = useMemo(() => dismissedOf(cvData), [cvData]);
  const dismiss = useCallback((r: JobRequirement) => setCvData(cv => (cv ? withDismissed(cv, r) : cv)), [setCvData]);
  const restore = useCallback((id: string) => setCvData(cv => (cv ? withRestored(cv, id) : cv)), [setCvData]);
  return { report, dismissed, dismiss, restore };
}
