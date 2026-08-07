import { memo } from 'react';
import { Loader2, Sparkles, Zap } from 'lucide-react';
import { Textarea } from '../../../../shared/ui/Textarea';
import { Button } from '../../../../shared/ui/Button';
import { OverflowIndicator } from '../OverflowIndicator';

interface Props {
  jobDescription: string;
  onJobDescriptionChange: (value: string) => void;
  actualPageCount: number;
  hasCvData: boolean;
  onAutoAssign: () => void;
  aiBusy: boolean;
  isOptimizing: boolean;
  optimizeSeconds: number;
  optimizeEstimate: number;
  onOptimize: () => void;
}

export const OptimizePanel = memo(function OptimizePanel({
  jobDescription, onJobDescriptionChange, actualPageCount, hasCvData,
  onAutoAssign, aiBusy, isOptimizing, optimizeSeconds, optimizeEstimate, onOptimize,
}: Props) {
  return (
    <section className="stitch-panel p-4 space-y-3 bg-blue-50/30 border-blue-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-blue-600">
          <Sparkles className="w-4 h-4" />
          <span className="text-[11px] font-bold uppercase tracking-widest">Adapter à l'offre</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-gray-600 uppercase">Pages :</label>
          <span className="text-[11px] stitch-mono font-bold text-blue-600">{actualPageCount}</span>
        </div>
      </div>

      {/* Job description display */}
      {jobDescription ? (
        <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[11px] stitch-mono text-gray-600 max-h-16 overflow-y-auto">
          <span className="font-bold text-gray-600 uppercase text-[11px]">Offre importée</span>
          <p className="mt-1 line-clamp-3">{jobDescription.slice(0, 300)}{jobDescription.length > 300 ? '...' : ''}</p>
        </div>
      ) : (
        <Textarea
          value={jobDescription}
          onChange={(e) => onJobDescriptionChange(e.target.value)}
          placeholder="Collez l'offre d'emploi ici pour le scoring de pertinence..."
          rows={2}
          className="border-blue-200 rounded-lg focus:border-blue-400 focus:ring-blue-400"
        />
      )}

      {/* Auto-assign button */}
      <Button
        variant="primary"
        fullWidth
        className="rounded-lg py-2 px-4 text-[11px] tracking-widest"
        icon={<Zap className="w-3.5 h-3.5" />}
        disabled={!hasCvData}
        onClick={onAutoAssign}
      >
        Réorganiser selon l'offre
      </Button>
      <p className="text-[11px] text-gray-600 -mt-1">Instantané : met en avant vos expériences les plus pertinentes, sans réécrire le texte.</p>

      {/* AI content optimization button */}
      <Button
        variant="secondary"
        fullWidth
        className="rounded-lg py-2 px-4 text-[11px] normal-case tracking-normal bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
        icon={isOptimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        loading={false}
        disabled={aiBusy}
        onClick={onOptimize}
      >
        {isOptimizing ? `Réécriture en cours... ${optimizeSeconds}s / ~${optimizeEstimate}s` : 'Réécrire le contenu avec l\'IA'}
      </Button>
      <p className="text-[11px] text-gray-600 -mt-1">
        {isOptimizing
          ? 'Vous pouvez continuer à naviguer, le CV se mettra à jour tout seul.'
          : `Réécrit vos textes pour coller à l'offre (~${optimizeEstimate}s, remplace le contenu actuel).`}
      </p>

      {/* Page count indicator */}
      <OverflowIndicator
        actualPageCount={actualPageCount}
        hasCvData={hasCvData}
      />
    </section>
  );
});
