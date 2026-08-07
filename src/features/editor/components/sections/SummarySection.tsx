import { memo } from 'react';
import { AlignLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { Textarea } from '../../../../shared/ui/Textarea';
import type { CVData } from '../../../../shared/types';

interface Props {
  summary: string | undefined;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  expanded: boolean;
  onToggle: () => void;
}

export const SummarySection = memo(function SummarySection({
  summary, setCvData, expanded, onToggle,
}: Props) {
  return (
    <section className="stitch-panel overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full stitch-panel-header flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlignLeft className="w-3 h-3" />
          <span>Résumé professionnel</span>
        </div>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <Textarea
            label="Résumé professionnel"
            rows={4}
            value={summary || ''}
            onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, summary: e.target.value}} : null)}
            placeholder="Décrivez brièvement votre parcours et vos objectifs..."
          />
        </div>
      )}
    </section>
  );
});
