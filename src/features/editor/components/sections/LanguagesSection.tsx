import { memo } from 'react';
import { ChevronDown, ChevronUp, Languages, Plus, Trash2 } from 'lucide-react';
import { Input } from '../../../../shared/ui/Input';
import { Select } from '../../../../shared/ui/Select';
import type { CVData, Language } from '../../../../shared/types';

interface Props {
  languages: Language[] | undefined;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  expanded: boolean;
  onToggle: () => void;
}

export const LanguagesSection = memo(function LanguagesSection({
  languages, setCvData, expanded, onToggle,
}: Props) {
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
          {languages?.map((lang, idx) => (
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
                  const newLang = [...(languages || [])];
                  newLang[idx].name = e.target.value;
                  setCvData(prev => prev ? {...prev, languages: newLang} : null);
                }}
              />
              <Select
                variant="bare"
                mono={false}
                className="text-blue-600"
                value={lang.proficiency}
                onChange={(e) => {
                  const newLang = [...(languages || [])];
                  newLang[idx].proficiency = e.target.value;
                  setCvData(prev => prev ? {...prev, languages: newLang} : null);
                }}
                options={[
                  { value: 'Natif', label: 'Natif' },
                  { value: 'Courant', label: 'Courant' },
                  { value: 'Intermédiaire', label: 'Intermédiaire' },
                  { value: 'Débutant', label: 'Débutant' },
                ]}
              />
            </div>
          ))}
          <button
            onClick={() => setCvData(prev => prev ? {...prev, languages: [...prev.languages, { name: 'Nouvelle Langue', proficiency: 'Courant' }]} : null)}
            className="w-full py-2 border border-dashed border-gray-300 text-[11px] stitch-mono text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-3 h-3" /> Ajouter une langue
          </button>
        </div>
      )}
    </section>
  );
});
