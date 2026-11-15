import type { CVSection, JobRequirement, ReadabilityCheck } from '@/src/shared/types';
import { gapsOf, isWrittenFreely, requirementConfirmationKey } from '../lib/keyword-analysis';
import { ATS_POLICY, ATS_SOURCES } from '../lib/ats-rules';
import type { RequirementsStatus } from '../lib/job-requirements-cache';
import type { ATSAnalysis } from '../hooks/useATSAnalysis';
import { Button } from '@/src/shared/ui/Button';
import { Link } from 'react-router-dom';

export interface ATSPanelProps {
  analysis: ATSAnalysis;
  hasJobDescription: boolean;
  requirementsStatus: RequirementsStatus;
  requirementsError?: string;
  onRetryAnalysis: () => void;
  onCorrect: (requirement: JobRequirement) => void;
  onCorrectCheck: (id: ReadabilityCheck['id']) => void;
  onOpenOffer: () => void;
  aiBusy?: boolean;
}

const SECTION_LABELS: Record<CVSection, string> = {
  title: 'titre', location: 'ville', summary: 'profil', experience: 'expériences',
  skills: 'compétences', education: 'formation', languages: 'langues',
};
const CHECK_LABELS: Record<ReadabilityCheck['id'], string> = {
  email: 'Adresse e-mail valide', phone: 'Numéro de téléphone', location: 'Ville',
  titles: 'Intitulés de poste écrits en entier (pas « Sr. », « Resp. »)',
  dates: 'Dates de poste lisibles (par exemple « mars 2021 »)',
  dateFormat: 'Dates écrites au même format partout (toutes avec le mois, ou toutes sans)',
  size: 'Taille PDF estimée sous 2,5 Mo ; fichier réel contrôlé à l’export',
};

export function ATSPanel({ analysis, hasJobDescription, requirementsStatus, requirementsError, onRetryAnalysis, onCorrect, onCorrectCheck, onOpenOffer, aiBusy = false }: ATSPanelProps) {
  const { report, dismissed, dismiss, restore, notRequirements, reject, unreject, generation, confirmed, confirm, unconfirm } = analysis;
  if (!report) return <p className="text-xs text-gray-600">Chargement de l'analyse ATS...</p>;
  const dismissedIds = dismissed.map(r => r.id);
  const covered = report.requirements.filter(c => c.found && !dismissedIds.includes(c.requirement.id));
  const gaps = gapsOf(report).filter(c => !dismissedIds.includes(c.requirement.id))
    .sort((a, b) => Number(b.requirement.importance === 'required') - Number(a.requirement.importance === 'required'));
  const additions = covered.filter(c => generation?.addedRequirementIds.includes(c.requirement.id) && !confirmed.includes(requirementConfirmationKey(c.requirement)));
  const checks = [...report.checks].sort((a, b) => Number(a.passed) - Number(b.passed));
  const sameRequirements = generation && JSON.stringify(generation.requirements) === JSON.stringify(report.requirements.map(c => c.requirement));
  const lost = sameRequirements && generation.initialScore !== null && report.score !== null && generation.initialScore > report.score;

  return <div className="flex flex-col gap-5 text-xs">
    <div role="status" aria-live="polite" className="space-y-2">
      {!hasJobDescription ? <><p>Ajoutez une offre pour comparer ses exigences à votre CV.</p><Button size="sm" onClick={onOpenOffer}>Ajouter une offre</Button></>
        : report.score !== null ? <>
          <p className="font-semibold text-gray-900">Couverture de l'offre : {report.score} %</p>
          <p className="text-gray-600">{report.required.covered}/{report.required.total} requises · {report.points.covered}/{report.points.total} points</p>
          <p className="text-gray-600">Présence des exigences extraites, sans garantie de classement ni d’entretien.</p>
        </> : report.requirements.length > 0 ? <p>Cette offre contient des conditions à vérifier, sans score de contenu.</p> : requirementsStatus === 'failed' ? <>
          <p>Analyse de l'offre indisponible pour le moment.</p><p>{requirementsError}</p>
          <Button size="sm" disabled={aiBusy} onClick={onRetryAnalysis}>Réessayer</Button>
        </> : <p>{requirementsStatus === 'pending' ? "L'offre sera analysée quand vous quitterez son champ de saisie." : "Analyse de l'offre en cours..."}</p>}
      {lost && <p className="text-amber-800">Le contenu complet couvrait {generation!.initialScore} %. Vérifiez les éléments masqués ou modifiés.<br /><Button size="sm" variant="ghost" onClick={onOpenOffer}>Voir la mise en page</Button></p>}
      {(generation?.extractionAtLimit || report.requirements.length >= ATS_POLICY.maxRequirements) && <p className="text-amber-800">Offre dense : limite d'extraction atteinte. Vérifiez les critères dans l'offre.</p>}
    </div>

    {hasJobDescription && !generation && <p className="text-gray-600">Ce CV n’a pas de bilan de génération. Le score le compare aux exigences actuelles de l’offre. <Link to="/dashboard" className="text-blue-700 underline">Relancer l’adaptation depuis le CV source</Link>.</p>}
    {generation && <p className="text-gray-600">Adaptation initiale : {generation.initialScore ?? 'sans score'}{generation.initialScore !== null ? ' % de couverture' : ''}. Les qualifications absentes du parcours restent distinctes des formulations à adapter.</p>}
    {generation?.completion && <p className="text-gray-600">Exigences de contenu traitées avant livraison : {generation.completion.skillsCovered}/{generation.completion.skillsTotal}. {generation.completion.qualificationGapIds.length > 0 ? `${generation.completion.qualificationGapIds.length} qualification(s) ou condition(s) non établies par le CV source.` : 'Aucun écart de qualification à la génération.'}</p>}
    {!!generation?.objectiveRequirementIds?.length && <p className="text-gray-600">À la génération, {generation.objectiveRequirementIds.length} terme(s) ont été présentés comme objectifs de transfert vers le poste, sans maîtrise revendiquée. Leur présence dans la couverture ne signifie pas que ces compétences sont déjà acquises.</p>}

    {gaps.length > 0 && <section className="space-y-2" aria-label="Exigences à corriger">
      <h2 className="font-semibold text-gray-900">Écarts ({gaps.length})</h2>
      {gaps.map(c => <div key={c.requirement.id} className="border border-gray-200 rounded p-3 space-y-2">
        <p className="font-medium">{c.requirement.label} <span className="text-gray-600 font-normal">{c.requirement.importance === 'required' ? '(requis)' : '(souhaité)'}</span></p>
        {c.status === 'unknown' && <p className="text-amber-800">À vérifier</p>}
        {c.reason && <p className="text-gray-600">{c.reason}</p>}
        {c.years !== undefined && <p className="text-gray-600">{c.years.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ans mesurés</p>}
        {generation?.relatedExperience?.filter(e => e.requirementId === c.requirement.id).map((e, i) => <details key={i} className="text-gray-600">
          <summary className="cursor-pointer font-medium">Expérience connexe citée à la génération</summary>
          <p className="mt-2">{e.adaptedQuote}</p><p className="mt-2">Source : « {e.sourceQuote} »</p>
          <p className="mt-2">Ce rapprochement met en valeur une pratique réelle ; il ne vaut ni certificat, ni diplôme, ni niveau de langue.</p>
        </details>)}
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" aria-label={`${c.requirement.label} : corriger`} onClick={() => onCorrect(c.requirement)}>Corriger</Button>
          {c.requirement.needsVerification && <Button size="sm" variant="ghost" onClick={() => confirm(c.requirement)}>Je confirme ce critère</Button>}
          <Button size="sm" variant="ghost" aria-label={`${c.requirement.label} : je ne l'ai pas`} onClick={() => dismiss(c.requirement)}>Je ne l'ai pas</Button>
          <Button size="sm" variant="ghost" aria-label={`${c.requirement.label} : ce n'est pas une exigence`} onClick={() => reject(c.requirement)}>Pas une exigence</Button>
        </div>
        <details className="text-gray-600"><summary className="cursor-pointer">Extrait de l'offre</summary><p className="mt-1">{c.requirement.quote}</p></details>
      </div>)}
    </section>}

    {additions.length > 0 && <section className="space-y-2" aria-label="Ajouts à confirmer">
      <h2 className="font-semibold">Ajouts à confirmer ({additions.length})</h2>
      <p className="text-gray-600">Ces mentions ont été ajoutées sans être retrouvées dans le CV source. Confirmez-les ou retirez-les.</p>
      {additions.map(c => <div key={c.requirement.id} className="flex flex-wrap items-center gap-1 border-b border-gray-200 pb-2">
        <span className="w-full font-medium">{c.requirement.label}</span>
        <Button size="sm" variant="secondary" aria-label={`${c.requirement.label} : confirmer`} onClick={() => confirm(c.requirement)}>Je confirme</Button>
        <Button size="sm" variant="ghost" aria-label={`${c.requirement.label} : vérifier le texte`} onClick={() => onCorrect(c.requirement)}>Voir le texte</Button>
        <Button size="sm" variant="ghost" aria-label={`${c.requirement.label} : je ne l'ai pas, retirer du CV`} onClick={() => dismiss(c.requirement)}>Retirer</Button>
      </div>)}
    </section>}

    <section className="space-y-2">
      <h2 className="font-semibold">Lisibilité par les ATS</h2>
      <ul className="space-y-2">{checks.map(check => <li key={check.id} className="flex gap-2 items-start">
        <span aria-hidden="true" className={check.passed ? 'text-green-700' : 'text-red-700'}>{check.passed ? '✓' : '✗'}</span>
        <span className="flex-1">{CHECK_LABELS[check.id]}<span className="sr-only">{check.passed ? ' : conforme' : ' : à corriger'}</span></span>
        {!check.passed && <Button size="sm" variant="ghost" aria-label={`Corriger : ${CHECK_LABELS[check.id]}`} onClick={() => onCorrectCheck(check.id)}>Corriger</Button>}
      </li>)}</ul>
    </section>

    {covered.length > 0 && <details className="space-y-2">
      <summary className="cursor-pointer font-semibold">Exigences couvertes ({covered.length})</summary>
      <ul className="space-y-3 mt-3">{covered.map(c => <li key={c.requirement.id}>
        <p>{c.requirement.label} <span className="text-gray-600">({c.sections.map(s => SECTION_LABELS[s]).join(', ') || 'déclaration du candidat'})</span></p>
        <p className="text-gray-600">{generation?.sourceRequirementIds.includes(c.requirement.id) ? 'Mention retrouvée dans la source' : confirmed.includes(requirementConfirmationKey(c.requirement)) ? 'Confirmé par vous' : 'Mention présente, provenance non vérifiée'}</p>
        {confirmed.includes(requirementConfirmationKey(c.requirement)) && <Button size="sm" variant="ghost" onClick={() => unconfirm(c.requirement)}>Annuler la confirmation</Button>}
        {isWrittenFreely(c.requirement) && !additions.some(a => a.requirement.id === c.requirement.id) && <Button size="sm" variant="ghost" aria-label={`${c.requirement.label} : je ne l'ai pas, retirer du CV`} onClick={() => dismiss(c.requirement)}>Retirer</Button>}
      </li>)}</ul>
    </details>}

    {dismissed.length > 0 && <section className="space-y-2"><h2 className="font-semibold">Écartées ({dismissed.length})</h2>
      <p className="text-gray-600">Retirées du CV imprimé, mais toujours comptées si l'offre les demande. Vos textes restent dans Contenu.</p>
      {dismissed.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2"><span>{r.label}</span><Button size="sm" variant="ghost" aria-label={`${r.label} : remettre`} onClick={() => restore(r.id)}>Remettre</Button></div>)}
    </section>}
    {notRequirements.length > 0 && <section className="space-y-2"><h2 className="font-semibold">Pas des exigences ({notRequirements.length})</h2>
      <p className="text-gray-600">Retirées du score ; aucun texte du CV n'est changé.</p>
      {notRequirements.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2"><span>{r.label}</span><Button size="sm" variant="ghost" aria-label={`${r.label} : recompter dans le score`} onClick={() => unreject(r.id)}>Recompter</Button></div>)}
    </section>}

    <details><summary className="cursor-pointer font-medium">Méthode et sources</summary>
      <p className="my-2 text-gray-600">Règles {ATS_POLICY.version}. Pondération Calibre : 3 points par exigence requise ou titre, 1 par souhait ou qualité humaine. Les conditions du formulaire restent à vérifier séparément.</p>
      {generation && <p className="mb-2 text-gray-600">Génération du {new Date(generation.createdAt).toLocaleDateString('fr-FR')} · {generation.model} · règles {generation.rulesVersion}. Les versions sont conservées avec ce CV.</p>}
      <ul className="space-y-2">{ATS_SOURCES.map(source => <li key={source.id}><a className="text-blue-700 underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.vendor} : {source.summary}</a><p className="text-gray-600">Vérifiée le {source.checkedAt}</p></li>)}</ul>
    </details>
  </div>;
}
