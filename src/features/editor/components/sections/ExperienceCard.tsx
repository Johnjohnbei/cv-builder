import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { cn } from '../../../../shared/lib/cn';
import { Input } from '../../../../shared/ui/Input';
import { Textarea } from '../../../../shared/ui/Textarea';
import { DISPLAY_MODES } from '../../lib/display-modes';
import { relevanceBand } from '../../lib/scoring';
import { COMPANY_STAGE_OPTIONS, COMPANY_BUSINESS_MODEL_OPTIONS } from '../../../../shared/constants/company-meta';
import type { WeakBulletResult } from '../../lib/weak-bullet-detection';
import type { Experience } from '../../../../shared/types';
import { ExperienceBullets } from './ExperienceBullets';

interface Props {
  exp: Experience;
  idx: number;
  isLast: boolean;
  /** Share of the offer's provable requirements this experience evidences, when there are some */
  score?: number;
  weakBullets: WeakBulletResult[];
  updateExperience: (idx: number, change: (exp: Experience) => Experience) => void;
  moveExperience: (from: number, to: number) => void;
  onDelete: (idx: number) => void;
}

const BAND_PALETTE = {
  high: { backgroundColor: '#dcfce7', color: '#166534' },
  medium: { backgroundColor: '#fef9c3', color: '#854d0e' },
  low: { backgroundColor: '#fee2e2', color: '#991b1b' },
};

const SELECT_CLASS = "text-[11px] font-mono text-gray-600 bg-gray-50/60 border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:bg-white focus:text-gray-700 cursor-pointer";

/** The editing card of one experience. Extracted from ExperienceSection, over its size limit. */
export function ExperienceCard({ exp, idx, isLast, score, weakBullets, updateExperience, moveExperience, onDelete }: Props) {
  const mode = exp.displayMode || 'normal';
  const currentMode = DISPLAY_MODES.find(m => m.value === mode)!;

  return (
    <div data-cv-block="experience" className="p-3 bg-gray-50 border border-[#DADCE0] rounded relative group">
      {/* ─── Top bar: move + badge + mode selector + delete ─── */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1">
          <button
            disabled={idx === 0}
            onClick={() => moveExperience(idx, idx - 1)}
            className="p-0.5 text-gray-600 hover:text-gray-900 disabled:opacity-20 transition-colors"
            title="Monter"
            aria-label="Monter cette expérience"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button
            disabled={isLast}
            onClick={() => moveExperience(idx, idx + 1)}
            className="p-0.5 text-gray-600 hover:text-gray-900 disabled:opacity-20 transition-colors"
            title="Descendre"
            aria-label="Descendre cette expérience"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
          <span className="text-[11px] stitch-mono text-gray-600 uppercase ml-1">#{idx + 1}</span>
          {score !== undefined && (
            <span
              className="text-[10px] stitch-mono ml-1 px-1 py-0.5 rounded"
              style={BAND_PALETTE[relevanceBand(score)]}
              title={`Cette expérience prouve ${score} % des exigences de l'offre qu'un poste peut démontrer (hors diplôme, langue et années). Le tri automatique condense d'abord les expériences les moins pertinentes.`}
            >
              {score}%
            </span>
          )}
        </div>

        <div className="flex bg-white border border-gray-200 rounded overflow-hidden">
          {DISPLAY_MODES.map((option) => (
            <button
              key={option.value}
              onClick={() => updateExperience(idx, x => ({ ...x, displayMode: option.value }))}
              title={option.label}
              className={cn(
                "px-1.5 py-0.5 text-[11px] stitch-mono transition-colors",
                mode === option.value ? "text-white" : "text-gray-600 hover:bg-gray-100"
              )}
              style={mode === option.value ? { backgroundColor: option.color } : undefined}
            >
              {option.icon}
            </button>
          ))}
        </div>

        <button
          onClick={() => onDelete(idx)}
          className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          title="Supprimer cette expérience"
          aria-label="Supprimer cette expérience"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <div className="text-[11px] stitch-mono uppercase tracking-widest mb-1.5" style={{ color: currentMode.color }}>
        {currentMode.label}
      </div>

      {/* Hidden mode: show only title, collapse everything else */}
      {mode === 'hidden' ? (
        <p className="text-[11px] text-gray-600 italic line-through">{exp.position} · {exp.company}</p>
      ) : (
        <>
          <Input
            variant="bare"
            className="font-bold mb-1"
            value={exp.position}
            placeholder="Intitulé du poste"
            onChange={(e) => {
              const position = e.target.value;
              updateExperience(idx, x => ({ ...x, position }));
            }}
          />
          <Input
            variant="bare"
            mono={false}
            className="text-blue-600"
            value={exp.company}
            placeholder="Nom de l'entreprise"
            onChange={(e) => {
              const company = e.target.value;
              updateExperience(idx, x => ({ ...x, company }));
            }}
          />
          {/* ─── Company tags (stage + business model) ─── */}
          <div className="grid grid-cols-2 gap-1.5 mt-1 mb-1">
            <select
              value={exp.companyStage || ''}
              onChange={(e) => {
                const companyStage = e.target.value || undefined;
                updateExperience(idx, x => ({ ...x, companyStage }));
              }}
              className={SELECT_CLASS}
              aria-label="Stade de l'entreprise"
            >
              <option value="">Stade…</option>
              {COMPANY_STAGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <select
              value={exp.companyBusinessModel || ''}
              onChange={(e) => {
                const companyBusinessModel = e.target.value || undefined;
                updateExperience(idx, x => ({ ...x, companyBusinessModel }));
              }}
              className={SELECT_CLASS}
              aria-label="Modèle économique"
            >
              <option value="">Modèle…</option>
              {COMPANY_BUSINESS_MODEL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          {/* ─── Intro (short role description) ─── */}
          <Textarea
            inputSize="xs"
            mono={false}
            className="mt-1 focus:border-blue-600"
            rows={2}
            value={exp.intro || ''}
            placeholder="Description courte du rôle (1-2 lignes, optionnel)"
            onChange={(e) => {
              const intro = e.target.value;
              updateExperience(idx, x => ({ ...x, intro }));
            }}
          />

          <div className="grid grid-cols-3 gap-2 mt-1">
            <Input
              inputSize="xs"
              className="focus:border-blue-600"
              value={exp.start_date}
              placeholder="Début"
              onChange={(e) => {
                const start_date = e.target.value;
                updateExperience(idx, x => ({ ...x, start_date }));
              }}
            />
            <Input
              inputSize="xs"
              className="focus:border-blue-600 disabled:opacity-40"
              value={exp.end_date || ''}
              placeholder="Fin"
              disabled={exp.current}
              onChange={(e) => {
                const end_date = e.target.value;
                updateExperience(idx, x => ({ ...x, end_date }));
              }}
            />
            <label className="flex items-center gap-1 text-[11px] font-mono text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={exp.current}
                onChange={(e) => {
                  const current = e.target.checked;
                  updateExperience(idx, x => ({ ...x, current, end_date: current ? '' : x.end_date }));
                }}
                className="w-3 h-3"
              />
              Actuel
            </label>
          </div>

          {/* ─── KPI field (single row: label + input + visibility toggle) ─── */}
          <div className="mt-2 flex items-center gap-2">
            <label className="text-[11px] stitch-mono text-emerald-700 uppercase shrink-0">KPI</label>
            <Input
              inputSize="xs"
              mono={false}
              className="flex-1 min-w-0 border-emerald-200 focus:border-emerald-500"
              value={exp.kpi || ''}
              placeholder="Ex: +35% de CA, 12 personnes managées..."
              onChange={(e) => {
                const kpi = e.target.value;
                updateExperience(idx, x => ({ ...x, kpi }));
              }}
            />
            <label
              className="flex items-center gap-1 text-[11px] font-mono text-gray-600 cursor-pointer shrink-0"
              title="Par défaut le KPI ne s'affiche qu'en mode Étendu. Coche pour forcer l'affichage quel que soit le mode."
            >
              <input
                type="checkbox"
                checked={exp.showKpi === true}
                onChange={(e) => {
                  const showKpi = e.target.checked ? true : undefined;
                  updateExperience(idx, x => ({ ...x, showKpi }));
                }}
                className="w-3 h-3"
              />
              Afficher
            </label>
          </div>

          <ExperienceBullets exp={exp} idx={idx} weakBullets={weakBullets} updateExperience={updateExperience} />
        </>
      )}
    </div>
  );
}
