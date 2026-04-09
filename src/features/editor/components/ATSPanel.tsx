import { useState } from 'react';
import type { ATSScoreResult, KeywordAnalysisResult } from '@/src/shared/types';
import { ScoreGauge } from '@/src/shared/ui/ScoreGauge';
import { Button } from '@/src/shared/ui/Button';

interface ATSPanelProps {
  score: ATSScoreResult | null;
  keywords: KeywordAnalysisResult;
  hasJobDescription: boolean;
  onAddSkill?: (skill: string) => void;
  onToggleAtsMode?: () => void;
  onRequestAIAnalysis?: () => void;
  onOptimizeBullets?: () => void;
  isOptimizing?: boolean;
  isAtsMode?: boolean;
}

/** Return Tailwind bg class based on score tier. */
function getBarColor(score: number): string {
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

/** Location abbreviation for keyword badges. */
function formatLocations(locations: string[]): string {
  const abbr: Record<string, string> = { summary: 'res', experience: 'exp', skills: 'comp', education: 'edu' };
  return locations.map(l => abbr[l] ?? l).join(', ');
}

function SubScoreBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-20 text-[11px] font-mono text-gray-500 shrink-0">{label}</span>
        <div className="flex-1 h-2 rounded bg-gray-200 border border-dashed border-gray-300" />
        <span className="text-[11px] font-mono text-gray-400 w-8 text-right">N/A</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-[11px] font-mono text-gray-500 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded bg-gray-200">
        <div className={`h-full rounded ${getBarColor(value)}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] font-mono text-gray-600 w-8 text-right">{value}</span>
    </div>
  );
}

export function ATSPanel({
  score,
  keywords,
  hasJobDescription,
  onAddSkill,
  onToggleAtsMode,
  onRequestAIAnalysis,
  onOptimizeBullets,
  isOptimizing,
  isAtsMode,
}: ATSPanelProps) {
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  if (!score) {
    return <div className="p-4 text-center text-gray-400 text-xs font-mono">Chargement de l'analyse ATS...</div>;
  }
  const visibleSuggestions = showAllSuggestions ? score.suggestions : score.suggestions.slice(0, 5);

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto">
      {/* ─── Score Gauge ─── */}
      <div className="flex flex-col items-center" role="status" aria-live="polite">
        <ScoreGauge score={score.overall} size={120} label="Score ATS" />
      </div>
      {/* ─── Sub-scores ─── */}
      <div className="flex flex-col gap-2">
        <SubScoreBar label="Format" value={score.format} />
        <SubScoreBar label="Contenu" value={score.content} />
        {hasJobDescription ? (
          <SubScoreBar label="Pertinence" value={score.relevance} />
        ) : (
          <SubScoreBar label="Pertinence" value={null} />
        )}
      </div>

      {!hasJobDescription && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 leading-relaxed">
          Importez une offre d'emploi pour obtenir le score complet et l'analyse des mots-cles.
        </div>
      )}

      {/* ─── Keywords ─── */}
      {hasJobDescription && keywords.totalCount > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500">
              Mots-cles
            </span>
            <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {keywords.matchedCount}/{keywords.totalCount}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {keywords.keywords.map(kw => (
              <span
                key={kw.keyword}
                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${
                  kw.found
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : 'bg-red-100 text-red-800 border-red-300'
                }`}
              >
                {kw.keyword}
                {kw.found && kw.locations.length > 0 && (
                  <span className="text-green-600 text-[8px]">({formatLocations(kw.locations)})</span>
                )}
                {!kw.found && onAddSkill && (
                  <button
                    onClick={() => onAddSkill(kw.keyword)}
                    className="ml-0.5 text-[8px] font-bold underline hover:text-red-900"
                    aria-label={`Ajouter la compétence ${kw.keyword}`}
                  >
                    Ajouter
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ─── Suggestions ─── */}
      {score.suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500">
            Suggestions
          </span>
          <ul className="flex flex-col gap-1.5">
            {visibleSuggestions.map((s, i) => (
              <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                <span className="shrink-0 text-gray-400">•</span>
                <span className="flex-1">{s}</span>
                {renderSuggestionAction(s, onAddSkill, onToggleAtsMode, isAtsMode)}
              </li>
            ))}
          </ul>
          {score.suggestions.length > 5 && (
            <button
              onClick={() => setShowAllSuggestions(v => !v)}
              className="text-[10px] font-mono text-blue-600 hover:underline self-start"
              aria-label={showAllSuggestions ? 'Réduire les suggestions' : `Voir toutes les suggestions (${score.suggestions.length})`}
            >
              {showAllSuggestions ? 'Reduire' : `Voir tout (${score.suggestions.length})`}
            </button>
          )}
        </div>
      )}

      {/* ─── Optimize Bullets ─── */}
      <Button
        variant="primary"
        size="sm"
        disabled={!hasJobDescription || isOptimizing}
        onClick={() => onOptimizeBullets?.()}
        title={!hasJobDescription ? "Importez une offre d'emploi" : undefined}
        className="w-full"
      >
        {isOptimizing ? 'Optimisation en cours...' : 'Optimiser pour cette offre'}
      </Button>
    </div>
  );
}

/** Render an action button for a suggestion if it matches known patterns. */
function renderSuggestionAction(
  suggestion: string,
  onAddSkill?: (skill: string) => void,
  onToggleAtsMode?: () => void,
  isAtsMode?: boolean,
) {
  const lower = suggestion.toLowerCase();
  if ((lower.includes('competence') || lower.includes('skill')) && onAddSkill) {
    const match = suggestion.match(/["\u00AB]([^"\u00BB]+)["\u00BB]/);
    const skill = match?.[1] ?? '';
    if (skill) {
      return (
        <button onClick={() => onAddSkill(skill)} className="text-[10px] font-mono text-blue-600 hover:underline shrink-0" aria-label={`Ajouter la compétence ${skill}`}>
          Ajouter
        </button>
      );
    }
  }
  if (lower.includes('ats') && !isAtsMode && onToggleAtsMode) {
    return (
      <button onClick={onToggleAtsMode} className="text-[10px] font-mono text-blue-600 hover:underline shrink-0" aria-label="Activer le mode ATS">
        Activer
      </button>
    );
  }
  return null;
}
