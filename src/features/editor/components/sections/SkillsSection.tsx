import { memo } from 'react';
import { Award, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../../../shared/lib/cn';
import { Input } from '../../../../shared/ui/Input';
import { SKILL_DISPLAY_MODES } from '../../lib/displayModes';
import type { CVData, SkillCategory } from '../../../../shared/types';

interface Props {
  skills: SkillCategory[] | undefined;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  expanded: boolean;
  onToggle: () => void;
}

export const SkillsSection = memo(function SkillsSection({
  skills, setCvData, expanded, onToggle,
}: Props) {
  return (
    <section className="stitch-panel overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full stitch-panel-header flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Award className="w-3 h-3" />
          <span>Compétences</span>
        </div>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {skills?.map((cat, catIdx) => (
            <div key={catIdx} className="space-y-2 p-3 bg-gray-50 border border-[#DADCE0] rounded relative group">
              {/* Skill category mode selector */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex bg-white border border-gray-200 rounded overflow-hidden">
                  {SKILL_DISPLAY_MODES.map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => {
                        const newSkills = [...(skills || [])];
                        newSkills[catIdx] = { ...newSkills[catIdx], displayMode: mode.value };
                        setCvData(prev => prev ? {...prev, skills: newSkills} : null);
                      }}
                      title={mode.label}
                      className={cn(
                        "px-1.5 py-0.5 text-[11px] stitch-mono transition-colors",
                        (cat.displayMode || 'normal') === mode.value
                          ? "text-white" : "text-gray-600 hover:bg-gray-100"
                      )}
                      style={(cat.displayMode || 'normal') === mode.value ? { backgroundColor: mode.color } : undefined}
                    >
                      {mode.icon}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    if (!window.confirm(`Supprimer la catégorie « ${cat.category} » et toutes ses compétences ?`)) return;
                    setCvData(prev => prev ? {...prev, skills: prev.skills.filter((_, i) => i !== catIdx)} : null);
                  }}
                  className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  title="Supprimer cette catégorie"
                  aria-label="Supprimer cette catégorie"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {(cat.displayMode || 'normal') === 'hidden' ? (
                <p className="text-[11px] text-gray-600 italic line-through">{cat.category}</p>
              ) : (
              <>
              <Input
                variant="bare"
                className="font-bold uppercase"
                value={cat.category}
                placeholder="NOM_CATEGORIE"
                onChange={(e) => {
                  const newSkills = [...(skills || [])];
                  newSkills[catIdx].category = e.target.value;
                  setCvData(prev => prev ? {...prev, skills: newSkills} : null);
                }}
              />
              <div className="flex flex-wrap gap-2">
                {cat.items?.map((skill, skillIdx) => (
                  <div key={skillIdx} className="flex items-center gap-1 px-2 py-0.5 bg-white text-gray-600 text-[11px] stitch-mono rounded border border-gray-200">
                    <span>{typeof skill === 'string' ? skill : JSON.stringify(skill)}</span>
                    <button onClick={() => {
                      const newSkills = [...(skills || [])];
                      newSkills[catIdx].items = newSkills[catIdx].items.filter((_, i) => i !== skillIdx);
                      setCvData(prev => prev ? {...prev, skills: newSkills} : null);
                    }}>
                      <Trash2 className="w-2 h-2" />
                    </button>
                  </div>
                ))}
              </div>
              <Input
                inputSize="xs"
                type="text"
                placeholder="Ajouter compétence..."
                className="focus:border-blue-600"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value;
                    if (val) {
                      const newSkills = [...(skills || [])];
                      newSkills[catIdx].items = [...newSkills[catIdx].items, val];
                      setCvData(prev => prev ? {...prev, skills: newSkills} : null);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
              </>
              )}
            </div>
          ))}
          <button
            onClick={() => setCvData(prev => prev ? {...prev, skills: [...prev.skills, { category: 'Nouvelle Catégorie', items: [] }]} : null)}
            className="w-full py-2 border border-dashed border-gray-300 text-[11px] stitch-mono text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-3 h-3" /> Ajouter une catégorie
          </button>
        </div>
      )}
    </section>
  );
});
