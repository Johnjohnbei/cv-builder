import type { CVSection, ReadabilityCheck, RequirementCoverage } from '@/src/shared/types';
import { gapsOf, isWrittenFreely } from '../lib/keyword-analysis';
import type { RequirementsStatus } from '../lib/job-requirements-cache';
import type { ATSAnalysis } from '../hooks/useATSAnalysis';
import { formatPoints as points, GAP_TITLE, ScoreSummary } from '@/src/shared/ui/ScoreSummary';
import { Button } from '@/src/shared/ui/Button';

export interface ATSPanelProps {
  /** The report and the actions on its gaps */
  analysis: ATSAnalysis;
  hasJobDescription: boolean;
  requirementsStatus: RequirementsStatus;
  /** Why the analysis of the offer failed, shown with the retry button */
  requirementsError?: string;
  /** Analyze the offer again after a failure */
  onRetryAnalysis: () => void;
  /** True while an AI action runs: the retry is disabled */
  aiBusy?: boolean;
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
  dates: 'Dates de poste lisibles (par exemple « mars 2021 »)',
};

const SECTION_TITLE = 'text-[11px] font-mono uppercase tracking-wider text-gray-500';


/** The years the dates add up to, so a verdict on years of experience can be checked */
const measuredYears = ({ years }: RequirementCoverage) =>
  years === undefined ? '' : ` · ${years.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${years < 2 ? 'an mesuré' : 'ans mesurés'}`;

/** The counting convention, shown where measured years are */
const yearsHint = ({ years }: RequirementCoverage) =>
  years === undefined ? undefined : "Mois de début et de fin compris. Une année écrite sans mois compte à partir de son milieu : précisez les mois pour un calcul exact.";

interface GapProps {
  coverage: RequirementCoverage;
  onDismiss: () => void;
}

/**
 * A requirement of the offer the CV does not cover. Nothing writes it after
 * the generation (arbitrage of 2026-10-07): the user who lacks it takes it out
 * of the reminder, and out of the CV where a sentence still names it.
 */
function GapItem({ coverage, onDismiss }: GapProps) {
  const { requirement } = coverage;
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] bg-red-50 border border-red-200 rounded px-2 py-1.5">
      <span className="font-semibold text-red-800">{requirement.label}</span>
      <span className="flex items-center gap-2 shrink-0">
        <span className="text-gray-600" title={yearsHint(coverage)}>{points(coverage.weight)}{measuredYears(coverage)}</span>
        {/* The label is in the accessible name: every gap has this button */}
        <Button variant="ghost" size="sm" mono={false} aria-label={`${requirement.label} : je ne l'ai pas`} onClick={onDismiss}>
          Je ne l'ai pas
        </Button>
      </span>
    </div>
  );
}

export function ATSPanel({
  analysis,
  hasJobDescription,
  requirementsStatus,
  requirementsError,
  onRetryAnalysis,
  aiBusy = false,
}: ATSPanelProps) {
  const { report, dismissed, dismiss, restore } = analysis;
  if (!report) {
    return <div className="p-4 text-center text-gray-600 text-xs font-mono">Chargement de l'analyse ATS...</div>;
  }
  // A dismissed requirement is set aside, "Remettre" beside it, even when a fact still writes it
  const setAside = report.requirements.filter(r => dismissed.includes(r.requirement.id));
  const covered = report.requirements.filter(r => r.found && !dismissed.includes(r.requirement.id));
  const gaps = gapsOf(report).filter(r => !dismissed.includes(r.requirement.id));

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto">
      {/* ─── Score, or why there is none ─── */}
      <div className="flex flex-col items-center" role="status" aria-live="polite">
        {!hasJobDescription ? (
          <p className="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 leading-relaxed">
            Importez une offre d'emploi pour mesurer la part de ses exigences présentes dans votre CV.
          </p>
        ) : report.score !== null ? (
          <ScoreSummary score={report.score} />
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
            {covered.map(c => (
              <span
                key={c.requirement.id}
                className="inline-flex items-center gap-1 text-[11px] pl-2 rounded border bg-green-100 text-green-800 border-green-300"
              >
                {c.requirement.label}
                <span className="text-green-700 text-[10px]" title={yearsHint(c)}>({c.sections.map(s => SECTION_LABELS[s]).join(', ')} · {points(c.weight)}{measuredYears(c)})</span>
                {/* The generation writes every skill of the offer: the user takes out the one they lack.
                    A degree, a language, years or a title are facts of their own CV: nothing to take out */}
                {isWrittenFreely(c.requirement) && <Button
                  variant="ghost" size="sm" mono={false} className="text-green-800"
                  aria-label={`${c.requirement.label} : je ne l'ai pas, retirer du CV`}
                  title="Je ne l'ai pas : retirer du CV"
                  onClick={() => dismiss(c.requirement.id)}
                >
                  Retirer
                </Button>}
              </span>
            ))}
          </div>

          {gaps.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-2">
              <span className={GAP_TITLE}>Écarts ({gaps.length})</span>
              {gaps.map(c => (
                <GapItem key={c.requirement.id} coverage={c} onDismiss={() => dismiss(c.requirement.id)} />
              ))}
            </div>
          )}

          {setAside.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-2">
              <span className={SECTION_TITLE}>Écartées ({setAside.length})</span>
              <p className="text-[11px] text-gray-500">Ce qui les écrit est retiré du CV imprimé ; vos textes restent dans l'onglet Contenu. Toujours comptées dans le score : un ATS les cherche quand même.</p>
              {setAside.map(c => (
                <div key={c.requirement.id} className="flex items-center justify-between gap-2 text-[11px] bg-gray-50 border border-gray-200 rounded px-2 py-1">
                  <span className="text-gray-600">{c.requirement.label}</span>
                  <Button variant="ghost" size="sm" mono={false} onClick={() => restore(c.requirement.id)}>Remettre</Button>
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
    </div>
  );
}
