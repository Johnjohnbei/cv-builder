import type { ATSReport } from '@/src/shared/types';
import { ScoreGauge } from './ScoreGauge';

/** The heading a list of gaps carries, wherever the gaps are shown */
export const GAP_TITLE = 'text-[11px] font-mono text-red-600';

/**
 * The ATS score and what it measures. One owner: the score is shown in the
 * editor's ATS tab only, measured on the CV as it prints (after the fit to pages).
 */
export function ScoreSummary({ score }: { score: NonNullable<ATSReport['score']> }) {
  return (
    <>
      <ScoreGauge score={score} size={120} label="Score ATS" />
      <p className="text-[11px] text-gray-500 text-center mt-2 leading-snug max-w-[240px]">
        Part des exigences de l'offre présentes dans votre CV, comme un ATS les recherche.
      </p>
    </>
  );
}
