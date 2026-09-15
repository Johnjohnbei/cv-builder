import type { ReactNode } from 'react';
import type { ATSReport, CVSection, ReadabilityCheck } from '@/src/shared/types';
import type { RequirementsStatus } from '../lib/jobRequirementsCache';
import { isWritable } from '../lib/keywordAnalysis';
import { ScoreGauge } from '@/src/shared/ui/ScoreGauge';
import { Button } from '@/src/shared/ui/Button';

interface ATSPanelProps {
  report: ATSReport | null;
  hasJobDescription: boolean;
  requirementsStatus: RequirementsStatus;
  /** Why the analysis of the offer failed, shown with the retry button */
  requirementsError?: string;
  /** Analyze the offer again after a failure */
  onRetryAnalysis: () => void;
  onOptimizeBullets?: () => void;
  isOptimizing?: boolean;
  /** True while ANY AI action runs (here or elsewhere): siblings are disabled */
  aiBusy?: boolean;
  /** Optional click handler for the auto-distribute CTA. Hides the CTA when undefined. */
  onAutoDistribute?: () => void;
  /** Disable + loading label on the auto-distribute CTA. */
  isDistributing?: boolean;
  /** Number of pending proposals — controls whether the CTA is rendered (hidden when > 0). */
  pendingProposalsCount?: number;
  /** Slot for the proposals review panel, rendered after the missing requirements. */
  proposalsSlot?: ReactNode;
}

const SECTION_LABELS: Record<CVSection, string> = {
  title: 'titre', summary: 'profil', experience: 'expériences',
  skills: 'compétences', education: 'formation', languages: 'langues',
};

const CHECK_LABELS: Record<ReadabilityCheck['id'], string> = {
  email: 'Adresse e-mail valide',
  phone: 'Numéro de téléphone',
  location: 'Ville',
  titles: 'Intitulés de poste écrits en entier (pas « Sr. », « Resp. »)',
};

const SECTION_TITLE = 'text-[11px] font-mono uppercase tracking-wider text-gray-500';

const points = (n: number) => `${n} pt${n > 1 ? 's' : ''}`;

export function ATSPanel({
  report,
  hasJobDescription,
  requirementsStatus,
  requirementsError,
  onRetryAnalysis,
  onOptimizeBullets,
  isOptimizing,
  aiBusy = false,
  onAutoDistribute,
  isDistributing,
  pendingProposalsCount = 0,
  proposalsSlot,
}: ATSPanelProps) {
  if (!report) {
    return <div className="p-4 text-center text-gray-600 text-xs font-mono">Chargement de l'analyse ATS...</div>;
  }
  const covered = report.requirements.filter(r => r.found);
  const gaps = report.requirements.filter(r => !r.found);
  const writableGaps = gaps.filter(g => isWritable(g.requirement));

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto">
      {/* ─── Score, or why there is none ─── */}
      <div className="flex flex-col items-center" role="status" aria-live="polite">
        {!hasJobDescription ? (
          <p className="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 leading-relaxed">
            Importez une offre d'emploi pour mesurer la part de ses exigences présentes dans votre CV.
          </p>
        ) : report.score !== null ? (
          <>
            <ScoreGauge score={report.score} size={120} label="Score ATS" />
            <p className="text-[11px] text-gray-500 text-center mt-2 leading-snug max-w-[240px]">
              Part des exigences de l'offre présentes dans votre CV, comme un ATS les recherche.
            </p>
          </>
        ) : requirementsStatus === 'failed' ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-xs text-gray-700">Analyse de l'offre indisponible pour le moment.</p>
            {requirementsError && <p className="text-[11px] text-gray-600">{requirementsError}</p>}
            <Button variant="secondary" size="sm" disabled={aiBusy} onClick={onRetryAnalysis}>Réessayer</Button>
          </div>
        ) : requirementsStatus === 'pending' ? (
          <p className="text-xs text-gray-600 text-center">L'offre sera analysée quand vous quitterez son champ de saisie.</p>
        ) : (
          <p className="text-xs text-gray-600 font-mono">Analyse de l'offre en cours...</p>
        )}
      </div>

      {/* ─── Requirements, with the points the score is made of ─── */}
      {report.requirements.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className={SECTION_TITLE}>Exigences de l'offre</span>
            <span className="text-[11px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded" title="Exigence requise ou intitulé : 3 points ; souhaitée ou qualité humaine : 1 point">
              {report.points.covered}/{points(report.points.total)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {covered.map(({ requirement, sections, weight }) => (
              <span
                key={requirement.id}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border bg-green-100 text-green-800 border-green-300"
              >
                {requirement.label}
                <span className="text-green-700 text-[10px]">({sections.map(s => SECTION_LABELS[s]).join(', ')} · {points(weight)})</span>
              </span>
            ))}
          </div>

          {onAutoDistribute && writableGaps.length >= 2 && pendingProposalsCount === 0 && (
            <Button
              variant="secondary"
              size="sm"
              loading={isDistributing}
              disabled={aiBusy && !isDistributing}
              onClick={onAutoDistribute}
              className="w-full mt-2"
            >
              {isDistributing ? 'Distribution en cours...' : `Répartir automatiquement (${writableGaps.length} exigences)`}
            </Button>
          )}
          {proposalsSlot}

          {gaps.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-2">
              <span className="text-[11px] font-mono text-red-600">Écarts ({gaps.length})</span>
              {gaps.map(({ requirement, weight }) => (
                <div key={requirement.id} className="flex items-center justify-between gap-2 text-[11px] bg-red-50 border border-red-200 rounded px-2 py-1.5">
                  <span className="font-semibold text-red-800">{requirement.label}</span>
                  <span className="text-gray-600 shrink-0">{points(weight)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Readability ─── */}
      <div className="flex flex-col gap-2">
        <span className={SECTION_TITLE}>Lisibilité par les ATS</span>
        <ul className="flex flex-col gap-1.5">
          {report.checks.map(check => (
            <li key={check.id} className="text-xs flex items-start gap-2">
              <span className={check.passed ? 'text-green-700' : 'text-red-600'} aria-hidden="true">{check.passed ? '✓' : '✗'}</span>
              <span className={check.passed ? 'text-gray-700' : 'text-red-800'}>
                {CHECK_LABELS[check.id]}
                <span className="sr-only">{check.passed ? ' : conforme' : ' : à corriger'}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Button
        variant="primary"
        size="sm"
        disabled={!hasJobDescription || isOptimizing || aiBusy}
        onClick={() => onOptimizeBullets?.()}
        title={!hasJobDescription ? "Importez une offre d'emploi" : undefined}
        className="w-full"
      >
        {isOptimizing ? 'Optimisation en cours...' : 'Optimiser pour cette offre'}
      </Button>
    </div>
  );
}
