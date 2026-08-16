import { memo, useMemo } from 'react';
import { Loader2, Sparkles, Zap, Globe } from 'lucide-react';
import { Textarea } from '../../../../shared/ui/Textarea';
import { Button } from '../../../../shared/ui/Button';
import { cn } from '../../../../shared/lib/cn';
import { OverflowIndicator } from '../OverflowIndicator';
import { getPortfolioVariants, pickPortfolioVariant, type PortfolioVariant } from '../../lib/portfolioVariants';

/** Page budgets a recruiter-facing CV realistically uses */
const PAGE_TARGETS = [1, 2, 3];

interface Props {
  jobDescription: string;
  onJobDescriptionChange: (value: string) => void;
  actualPageCount: number;
  hasCvData: boolean;
  targetPages: number;
  onTargetPagesChange: (n: number) => void;
  isFitting: boolean;
  onFitToPages: () => void;
  onApplyPortfolio: (variant: PortfolioVariant) => void;
  aiBusy: boolean;
  isOptimizing: boolean;
  optimizeSeconds: number;
  optimizeEstimate: number;
  onOptimize: () => void;
}

export const OptimizePanel = memo(function OptimizePanel({
  jobDescription, onJobDescriptionChange, actualPageCount, hasCvData,
  targetPages, onTargetPagesChange, isFitting, onFitToPages,
  onApplyPortfolio,
  aiBusy, isOptimizing, optimizeSeconds, optimizeEstimate, onOptimize,
}: Props) {
  // Empty for anyone who has not configured VITE_PORTFOLIO_VARIANTS, which
  // makes the whole block disappear rather than showing an empty affordance.
  const portfolioMatch = useMemo(
    () => pickPortfolioVariant(getPortfolioVariants(), jobDescription),
    [jobDescription],
  );

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

      {/* Portfolio version matching the offer. Hidden unless variants are configured. */}
      {portfolioMatch && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2">
          <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-gray-900 truncate">{portfolioMatch.variant.label}</p>
            <p className="text-[11px] text-gray-600">
              {portfolioMatch.hits} terme{portfolioMatch.hits > 1 ? 's' : ''} de l'offre en commun
            </p>
          </div>
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0 text-[11px]"
            disabled={!hasCvData}
            onClick={() => onApplyPortfolio(portfolioMatch.variant)}
          >
            Ajouter au CV
          </Button>
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
        targetPages={targetPages}
        hasCvData={hasCvData}
      />
    </section>
  );
});
