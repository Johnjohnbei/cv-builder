import { memo } from 'react';
import { ChevronDown, ChevronUp, Languages, Plus, Trash2 } from 'lucide-react';
import { Input } from '../../../../shared/ui/Input';
import { Select } from '../../../../shared/ui/Select';
import { normalizeProficiency } from '../../lib/formatting';
import type { CVData, Language } from '../../../../shared/types';

/** Standard levels, in the labels normalizeProficiency renders on the CV */
const PROFICIENCY_LEVELS = ['Natif / Bilingue', 'Courant (C1)', 'Professionnel (B2)', 'Intermédiaire (B1)', 'Débutant (A2)'];

interface Props {
  languages: Language[] | undefined;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  expanded: boolean;
  onToggle: () => void;
}

export const LanguagesSection = memo(function LanguagesSection({
  languages, setCvData, expanded, onToggle,
}: Props) {
  // A new object per edit, never an assignment into the previous state
  const updateLanguage = (idx: number, change: (lang: Language) => Language) =>
    setCvData(prev => prev
      ? { ...prev, languages: prev.languages.map((lang, i) => (i === idx ? change(lang) : lang)) }
      : null);

  return (
    <section className="stitch-panel overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full stitch-panel-header flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Languages className="w-3 h-3" />
          <span>Langues</span>
        </div>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {languages?.map((lang, idx) => {
            // Shown under the label the CV prints. An imported level such as
            // "Full professional" is listed as it is: the select used to fall
            // back to its first option and display "Natif" for it.
            const shown = normalizeProficiency(lang.proficiency || '', 'fr');
            const levels = shown && !PROFICIENCY_LEVELS.includes(shown) ? [shown, ...PROFICIENCY_LEVELS] : PROFICIENCY_LEVELS;
            return (
              <div key={idx} className="p-3 bg-gray-50 border border-[#DADCE0] rounded relative group grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    if (!window.confirm(`Supprimer la langue « ${lang.name} » ?`)) return;
                    setCvData(prev => prev ? {...prev, languages: prev.languages.filter((_, i) => i !== idx)} : null);
                  }}
                  className="absolute -top-2 -right-2 p-1 bg-white border border-gray-200 rounded-full text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity shadow-sm z-10"
                  title="Supprimer cette langue"
                  aria-label="Supprimer cette langue"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <Input
                  variant="bare"
                  mono={false}
                  className="font-bold"
                  value={lang.name}
                  placeholder="Langue"
                  onChange={(e) => {
                    const name = e.target.value;
                    updateLanguage(idx, l => ({ ...l, name }));
                  }}
                />
                <Select
                  variant="bare"
                  mono={false}
                  className="text-blue-600"
                  aria-label={`Niveau en ${lang.name || 'cette langue'}`}
                  value={shown}
                  onChange={(e) => {
                    const proficiency = e.target.value;
                    updateLanguage(idx, l => ({ ...l, proficiency }));
                  }}
                  options={[
                    ...(shown ? [] : [{ value: '', label: 'Niveau…' }]),
                    ...levels.map(level => ({ value: level, label: level })),
                  ]}
                />
              </div>
            );
          })}
          <button
            onClick={() => setCvData(prev => prev ? {...prev, languages: [...prev.languages, { name: 'Nouvelle Langue', proficiency: 'Courant (C1)' }]} : null)}
            className="w-full py-2 border border-dashed border-gray-300 text-[11px] stitch-mono text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-3 h-3" /> Ajouter une langue
          </button>
        </div>
      )}
    </section>
  );
});
