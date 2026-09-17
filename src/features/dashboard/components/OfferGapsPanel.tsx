import type { JobRequirement } from '@/src/shared/types';
import { MAX_PROOF_CHARS } from '@/src/shared/types';
import { weightOf } from '@/src/features/editor/lib/keywordAnalysis';
import { formatPoints, GAP_TITLE } from '@/src/shared/ui/ScoreSummary';
import { Button } from '@/src/shared/ui/Button';
import { Textarea } from '@/src/shared/ui/Textarea';

interface Props {
  requirementCount: number;
  /** Requirements the CV does not prove and a proof can write */
  provable: JobRequirement[];
  /** A degree, a language, years or a title the CV does not state */
  factual: JobRequirement[];
  proofs: Record<string, string>;
  onProofChange: (id: string, text: string) => void;
  /** Ids of the proofs started but too short to say where */
  tooShort: string[];
  dismissed: string[];
  onDismiss: (id: string) => void;
  onRestore: (id: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  isGenerating: boolean;
  generatingSeconds: number;
}

/**
 * Before the CV is written (plan of 2026-09-17, lot D): what the CV does not
 * prove of the offer, asked while the one generation can still use the answer.
 * Each answer is the candidate's own words; an empty one leaves a gap.
 */
export function OfferGapsPanel({
  requirementCount, provable, factual, proofs, onProofChange, tooShort, dismissed, onDismiss, onRestore,
  onGenerate, onCancel, isGenerating, generatingSeconds,
}: Props) {
  const asked = provable.filter(r => !dismissed.includes(r.id));
  const setAside = provable.filter(r => dismissed.includes(r.id));
  const proven = requirementCount - provable.length - factual.length;
  return (
    <section className="stitch-panel" aria-labelledby="offer-gaps-title">
      <div id="offer-gaps-title" className="stitch-panel-header">Avant d'écrire votre CV</div>
      <div className="p-4 space-y-4 text-sm">
        <p className="text-xs text-gray-700 leading-relaxed">
          {`Votre CV prouve ${proven} exigence${proven > 1 ? 's' : ''} de l'offre sur ${requirementCount}. `}
          {asked.length > 0
            ? "Pour chaque écart, dites où vous l'avez mis en œuvre : l'IA l'écrira dans votre CV avec vos mots. Laissez vide pour le laisser en écart."
            : 'Vous avez écarté toutes les questions : le CV sera écrit sans ces exigences.'}
        </p>

        {asked.length > 0 && (
          <ul className="space-y-3">
            {asked.map(r => (
              <li key={r.id} className="flex flex-col gap-1.5 bg-red-50 border border-red-200 rounded px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-red-800">{r.label}</span>
                  <span className="text-gray-600 shrink-0">{formatPoints(weightOf(r))}</span>
                </div>
                <p className="text-[11px] text-gray-600 italic">« {r.quote} »</p>
                <Textarea
                  id={`gap-proof-${r.id}`}
                  label={`Où avez-vous mis en œuvre « ${r.label} » ?`}
                  mono={false}
                  inputSize="sm"
                  rows={2}
                  maxLength={MAX_PROOF_CHARS}
                  value={proofs[r.id] ?? ''}
                  onChange={(e) => onProofChange(r.id, e.target.value)}
                  placeholder="Ex. : chez Acme, j'ai mené les tests utilisateurs de l'application mobile"
                  disabled={isGenerating}
                  aria-invalid={tooShort.includes(r.id)}
                  aria-describedby={tooShort.includes(r.id) ? `gap-proof-${r.id}-hint` : undefined}
                />
                {tooShort.includes(r.id) && (
                  <p id={`gap-proof-${r.id}-hint`} className="text-[11px] text-red-700">Précisez où : une mission, un projet, un employeur (4 mots au moins).</p>
                )}
                <div>
                  <Button
                    variant="ghost" size="sm" mono={false} disabled={isGenerating}
                    aria-label={`${r.label} : je ne l'ai pas`}
                    onClick={() => onDismiss(r.id)}
                  >
                    Je ne l'ai pas
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {setAside.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-mono uppercase tracking-wider text-gray-500">Écartées ({setAside.length})</p>
            {setAside.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-[11px] bg-gray-50 border border-gray-200 rounded px-2 py-1">
                <span className="text-gray-600">{r.label}</span>
                <Button variant="ghost" size="sm" mono={false} disabled={isGenerating} onClick={() => onRestore(r.id)}>Remettre</Button>
              </div>
            ))}
          </div>
        )}

        {factual.length > 0 && (
          <div className="space-y-1.5">
            <p className={GAP_TITLE}>Absentes de votre CV ({factual.length})</p>
            <ul className="flex flex-wrap gap-1.5">
              {factual.map(r => (
                <li key={r.id} className="text-[11px] px-2 py-0.5 rounded border bg-red-50 text-red-800 border-red-200">{r.label}</li>
              ))}
            </ul>
            <p className="text-[11px] text-gray-600">
              Un intitulé, un diplôme, une langue ou des années d'expérience ne s'écrivent pas par une réécriture : ajoutez-les dans l'onglet Contenu de l'éditeur si vous les avez.
            </p>
          </div>
        )}

        {tooShort.length > 0 && (
          <p role="status" className="text-[11px] text-red-700 sm:text-right">
            {tooShort.length > 1 ? `${tooShort.length} réponses sont trop courtes` : 'Une réponse est trop courte'} : complétez ou videz pour écrire le CV.
          </p>
        )}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="ghost" mono={false} disabled={isGenerating} onClick={onCancel}>Annuler</Button>
          <Button mono={false} loading={isGenerating} disabled={isGenerating || tooShort.length > 0} onClick={onGenerate}>
            {isGenerating ? `Écriture du CV… ${generatingSeconds}s` : 'Écrire mon CV'}
          </Button>
        </div>
      </div>
    </section>
  );
}
