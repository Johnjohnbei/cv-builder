import { memo, useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, Zap } from 'lucide-react';
import { Textarea } from '../../../../shared/ui/Textarea';
import { Button } from '../../../../shared/ui/Button';
import { cn } from '../../../../shared/lib/cn';
import { OverflowIndicator } from '../OverflowIndicator';

/** Page budgets a recruiter-facing CV realistically uses */
const PAGE_TARGETS = [1, 2, 3];

interface Props {
  jobDescription: string;
  onJobDescriptionChange: (value: string) => void;
  /** The offer is done being edited: its AI keywords are worth extracting */
  onJobDescriptionCommit: () => void;
  actualPageCount: number;
  hasClippedContent: boolean;
  hasCvData: boolean;
  targetPages: number;
  onTargetPagesChange: (n: number) => void;
  isFitting: boolean;
  onFitToPages: () => void;
  aiBusy: boolean;
  isOptimizing: boolean;
  optimizeSeconds: number;
  optimizeEstimate: number;
  onOptimize: () => void;
}

export const OptimizePanel = memo(function OptimizePanel({
  jobDescription, onJobDescriptionChange, onJobDescriptionCommit, actualPageCount, hasClippedContent, hasCvData,
  targetPages, onTargetPagesChange, isFitting, onFitToPages,
  aiBusy, isOptimizing, optimizeSeconds, optimizeEstimate, onOptimize,
}: Props) {
  // Focusing the field expands it for good; only "Replier l'offre" collapses it.
  // The preview used to replace the field at the first character typed, while
  // focused (no offer could be typed, and the unmounted field never fired the
  // blur that commits the offer); collapsing it on blur instead moved every
  // control below up by ~100px between mousedown and mouseup, losing the click.
  const [isJDExpanded, setIsJDExpanded] = useState(false);
  const jdFieldRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLButtonElement>(null);
  // Each toggle button unmounts itself: focus goes to what replaces it, not to
  // <body> ("modifier" opens the field ready to type, "Replier" returns to the preview)
  const focusAfterToggle = useRef<'field' | 'preview' | null>(null);
  useEffect(() => {
    if (focusAfterToggle.current === 'field') jdFieldRef.current?.focus();
    if (focusAfterToggle.current === 'preview') previewRef.current?.focus();
    focusAfterToggle.current = null;
  }, [isJDExpanded]);

  return (
    <section className="stitch-panel p-4 space-y-3 bg-blue-50/30 border-blue-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-blue-600">
          <Sparkles className="w-4 h-4" />
          <span className="text-[11px] font-bold uppercase tracking-widest">Adapter à l'offre</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-600 uppercase">Pages :</span>
          <span className="text-[11px] stitch-mono font-bold text-blue-600">{actualPageCount}</span>
        </div>
      </div>

      {/* Job description. Collapsed to a preview once loaded to save room, but
          always expandable and always editable: it used to become a read-only
          300-character stub, so the only place to read or fix the end of an
          offer was the cover-letter drawer. */}
      {jobDescription && !isJDExpanded ? (
        <button
          ref={previewRef}
          type="button"
          onClick={() => {
            focusAfterToggle.current = 'field';
            setIsJDExpanded(true);
          }}
          className="w-full text-left bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[11px] stitch-mono text-gray-600 hover:border-blue-300 transition-colors"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="font-bold uppercase">Offre importée</span>
            <span className="font-normal normal-case text-blue-600 shrink-0">
              {jobDescription.length} caractères · modifier
            </span>
          </span>
          <span className="mt-1 line-clamp-2 block">{jobDescription}</span>
        </button>
      ) : (
        <div className="space-y-1">
          <Textarea
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            ref={jdFieldRef}
            onFocus={() => setIsJDExpanded(true)}
            onBlur={onJobDescriptionCommit}
            placeholder="Collez l'offre d'emploi ici pour le scoring de pertinence..."
            rows={jobDescription ? 8 : 2}
            className="border-blue-200 rounded-lg focus:border-blue-400 focus:ring-blue-400"
          />
          {jobDescription && (
            <button
              type="button"
              onClick={() => {
                focusAfterToggle.current = 'preview';
                setIsJDExpanded(false);
              }}
              className="text-[11px] text-blue-600 hover:underline"
            >
              Replier l'offre
            </button>
          )}
        </div>
      )}

      {/* Target page budget */}
      <div className="flex items-center gap-2">
        <span id="target-pages-label" className="text-[11px] text-gray-600 uppercase">Tenir en</span>
        <div className="flex rounded-lg border border-blue-200 overflow-hidden" role="group" aria-labelledby="target-pages-label">
          {PAGE_TARGETS.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onTargetPagesChange(n)}
              aria-pressed={targetPages === n}
              className={cn(
                'px-2.5 py-1 text-[11px] stitch-mono font-bold transition-colors',
                targetPages === n ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-blue-50',
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-gray-600">page{targetPages > 1 ? 's' : ''}</span>
      </div>

      {/* Fit button */}
      <Button
        variant="primary"
        fullWidth
        className="rounded-lg py-2 px-4 text-[11px] tracking-widest"
        icon={isFitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
        disabled={!hasCvData || isFitting}
        onClick={onFitToPages}
      >
        {isFitting ? 'Ajustement…' : `Faire tenir en ${targetPages} page${targetPages > 1 ? 's' : ''}`}
      </Button>
      <p className="text-[11px] text-gray-600 -mt-1">
        Instantané : remet chaque expérience au niveau de détail que sa pertinence pour l'offre justifie, puis condense les moins utiles jusqu'à tenir dans le format. Aucun texte n'est réécrit, tout reste réversible.
      </p>

      {/* AI content optimization button */}
      <Button
        variant="secondary"
        fullWidth
        className="rounded-lg py-2 px-4 text-[11px] normal-case tracking-normal bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
        icon={isOptimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        loading={false}
        disabled={aiBusy || !jobDescription.trim()}
        onClick={onOptimize}
      >
        {isOptimizing ? `Adaptation en cours... ${optimizeSeconds}s / ~${optimizeEstimate}s` : "Adapter le CV à l'offre"}
      </Button>
      <p className="text-[11px] text-gray-600 -mt-1">
        {isOptimizing
          ? "L'édition reprend dès la fin de l'adaptation, pour que rien ne soit écrasé."
          : jobDescription.trim()
            ? `Réécrit vos textes pour l'offre sans rien inventer : une exigence n'est écrite que si votre parcours la prouve (~${optimizeEstimate}s, remplace le contenu actuel).`
            : 'Collez une offre pour adapter le CV.'}
      </p>

      {/* Page count indicator */}
      <OverflowIndicator
        actualPageCount={actualPageCount}
        targetPages={targetPages}
        hasCvData={hasCvData}
        hasClippedContent={hasClippedContent}
      />
    </section>
  );
});
