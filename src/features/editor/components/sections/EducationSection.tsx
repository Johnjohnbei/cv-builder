import { memo } from 'react';
import { ChevronDown, ChevronUp, GraduationCap, Plus, Trash2 } from 'lucide-react';
import { Input } from '../../../../shared/ui/Input';
import type { CVData, Education } from '../../../../shared/types';

interface Props {
  education: Education[] | undefined;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  expanded: boolean;
  onToggle: () => void;
}

export const EducationSection = memo(function EducationSection({
  education, setCvData, expanded, onToggle,
}: Props) {
  return (
    <section className="stitch-panel overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full stitch-panel-header flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <GraduationCap className="w-3 h-3" />
          <span>Formation</span>
        </div>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {education?.map((edu, idx) => (
            <div key={idx} className="p-3 bg-gray-50 border border-[#DADCE0] rounded relative group space-y-2">
              <button
                onClick={() => {
                  if (!window.confirm(`Supprimer la formation « ${edu.degree || edu.school} » ?`)) return;
                  setCvData(prev => prev ? {...prev, education: prev.education.filter((_, i) => i !== idx)} : null);
                }}
                className="absolute top-2 right-2 p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                title="Supprimer cette formation"
                aria-label="Supprimer cette formation"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <Input
                variant="bare"
                mono={false}
                className="font-bold"
                value={edu.degree}
                placeholder="Diplôme"
                onChange={(e) => {
                  const newEdu = [...(education || [])];
                  newEdu[idx].degree = e.target.value;
                  setCvData(prev => prev ? {...prev, education: newEdu} : null);
                }}
              />
              <Input
                variant="bare"
                mono={false}
                className="text-blue-600"
                value={edu.school}
                placeholder="École"
                onChange={(e) => {
                  const newEdu = [...(education || [])];
                  newEdu[idx].school = e.target.value;
                  setCvData(prev => prev ? {...prev, education: newEdu} : null);
                }}
              />
              <Input
                variant="bare"
                mono={false}
                className="text-gray-600"
                value={edu.end_date}
                placeholder="Année"
                onChange={(e) => {
                  const newEdu = [...(education || [])];
                  newEdu[idx].end_date = e.target.value;
                  setCvData(prev => prev ? {...prev, education: newEdu} : null);
                }}
              />
            </div>
          ))}
          <button
            onClick={() => setCvData(prev => prev ? {...prev, education: [...prev.education, { school: 'Nouvelle École', degree: 'Nouveau Diplôme', start_date: '2020', end_date: '2024' }]} : null)}
            className="w-full py-2 border border-dashed border-gray-300 text-[11px] stitch-mono text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-3 h-3" /> Ajouter une formation
          </button>
        </div>
      )}
    </section>
  );
});
