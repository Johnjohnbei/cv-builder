import { memo } from 'react';
import { Briefcase, ChevronDown, ChevronUp, Plus, Sparkles } from 'lucide-react';
import { Button } from '../../../../shared/ui/Button';
import type { WeakBulletResult } from '../../lib/weakBulletDetection';
import type { CVData, Experience } from '../../../../shared/types';
import { ExperienceCard } from './ExperienceCard';

interface Props {
  experience: Experience[] | undefined;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  /** Share of the offer's provable requirements each experience evidences; empty without them */
  experienceScores: number[];
  weakBullets: WeakBulletResult[];
  expanded: boolean;
  onToggle: () => void;
  aiBusy: boolean;
  isEnrichingExperiences: boolean;
  onEnrich: () => void;
}

export const ExperienceSection = memo(function ExperienceSection({
  experience, setCvData, experienceScores,
  weakBullets, expanded, onToggle, aiBusy, isEnrichingExperiences, onEnrich,
}: Props) {
  // Every edit goes through these: a new object per changed experience, built
  // from the latest state. Edits used to assign into `experience[idx]` in
  // place, which kept the same reference, so the pagination engine (it
  // propagates block data by reference) kept painting and exporting the old
  // text while the sidebar showed the new one.
  const updateExperience = (idx: number, change: (exp: Experience) => Experience) =>
    setCvData(prev => prev
      ? { ...prev, experience: prev.experience.map((exp, i) => (i === idx ? change(exp) : exp)) }
      : null);

  const moveExperience = (from: number, to: number) =>
    setCvData(prev => {
      if (!prev || to < 0 || to >= prev.experience.length) return prev;
      const next = [...prev.experience];
      [next[from], next[to]] = [next[to], next[from]];
      return { ...prev, experience: next };
    });

  const deleteExperience = (idx: number) => {
    const exp = experience?.[idx];
    if (!exp || !window.confirm(`Supprimer l'expérience « ${exp.position || exp.company} » ? Cette action est définitive.`)) return;
    setCvData(prev => prev ? { ...prev, experience: prev.experience.filter((_, i) => i !== idx) } : null);
  };

  return (
    <section className="stitch-panel overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full stitch-panel-header flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Briefcase className="w-3 h-3" />
          <span>Expériences</span>
        </div>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* ─── Bulk auto-detect company stage + business model ─── */}
          {experience && experience.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              fullWidth
              loading={isEnrichingExperiences}
              disabled={aiBusy && !isEnrichingExperiences}
              icon={<Sparkles className="w-3 h-3" />}
              onClick={onEnrich}
              className="border border-dashed border-gray-300 text-[11px] stitch-mono uppercase tracking-wider text-gray-600 hover:text-blue-600 hover:border-blue-300"
            >
              {isEnrichingExperiences ? 'Détection en cours…' : 'Auto-détecter stade + modèle (IA)'}
            </Button>
          )}
          {experience?.map((exp, idx) => (
            <ExperienceCard
              key={idx}
              exp={exp}
              idx={idx}
              isLast={idx === experience.length - 1}
              score={experienceScores[idx]}
              weakBullets={weakBullets}
              updateExperience={updateExperience}
              moveExperience={moveExperience}
              onDelete={deleteExperience}
            />
          ))}
          <button
            onClick={() => setCvData(prev => prev ? {...prev, experience: [...prev.experience, { company: 'Nouvelle Entreprise', position: 'Nouveau Poste', start_date: '2024', current: true, description: [] }]} : null)}
            className="w-full py-2 border border-dashed border-gray-300 text-[11px] stitch-mono text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-3 h-3" /> Ajouter une expérience
          </button>
        </div>
      )}
    </section>
  );
});
