import { memo } from 'react';
import { Briefcase, ChevronDown, ChevronUp, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '../../../../shared/lib/cn';
import { Input } from '../../../../shared/ui/Input';
import { Textarea } from '../../../../shared/ui/Textarea';
import { Button } from '../../../../shared/ui/Button';
import { DISPLAY_MODES } from '../../lib/displayModes';
import { relevanceBand } from '../../lib/scoring';
import { COMPANY_STAGE_OPTIONS, COMPANY_BUSINESS_MODEL_OPTIONS } from '../../../../shared/constants/companyMeta';
import { BulletDiffView } from '../BulletDiffView';
import type { RewriteKey, UseBulletOptimizationResult } from '../../hooks/useBulletOptimization';
import type { WeakBulletResult } from '../../lib/weakBulletDetection';
import type { CVData, Experience } from '../../../../shared/types';

interface Props {
  experience: Experience[] | undefined;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  hasJobDescription: boolean;
  experienceScores: number[];
  weakBullets: WeakBulletResult[];
  expanded: boolean;
  onToggle: () => void;
  aiBusy: boolean;
  isEnrichingExperiences: boolean;
  onEnrich: () => void;
  bullets: UseBulletOptimizationResult;
}

export const ExperienceSection = memo(function ExperienceSection({
  experience, setCvData, hasJobDescription, experienceScores,
  weakBullets, expanded, onToggle, aiBusy, isEnrichingExperiences, onEnrich, bullets,
}: Props) {
  const getWeakIssues = (expIdx: number, bulIdx: number) =>
    weakBullets.find(w => w.expIndex === expIdx && w.bulletIndex === bulIdx);

  // Every edit goes through these two: a new object per changed experience,
  // built from the latest state. Edits used to assign into `experience[idx]` in
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
            <div key={idx} data-cv-block="experience" className="p-3 bg-gray-50 border border-[#DADCE0] rounded relative group">
              {/* ─── Top bar: drag + mode selector + delete ─── */}
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-1">
                  {/* Move up/down */}
                  <button
                    disabled={idx === 0}
                    onClick={() => moveExperience(idx, idx - 1)}
                    className="p-0.5 text-gray-600 hover:text-gray-900 disabled:opacity-20 transition-colors"
                    title="Monter"
                    aria-label="Monter cette expérience"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    disabled={idx === (experience?.length || 0) - 1}
                    onClick={() => moveExperience(idx, idx + 1)}
                    className="p-0.5 text-gray-600 hover:text-gray-900 disabled:opacity-20 transition-colors"
                    title="Descendre"
                    aria-label="Descendre cette expérience"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <span className="text-[11px] stitch-mono text-gray-600 uppercase ml-1">#{idx + 1}</span>
                  {hasJobDescription && (() => {
                    const s = experienceScores[idx] ?? 0;
                    const band = relevanceBand(s);
                    const palette = {
                      high: { backgroundColor: '#dcfce7', color: '#166534' },
                      medium: { backgroundColor: '#fef9c3', color: '#854d0e' },
                      low: { backgroundColor: '#fee2e2', color: '#991b1b' },
                    }[band];
                    return (
                      <span
                        className="text-[10px] stitch-mono ml-1 px-1 py-0.5 rounded"
                        style={palette}
                        title={`Cette expérience couvre ${s} % de ce que l'offre demande. C'est ce chiffre qui décide de l'ordre du tri automatique : les plus bas perdent leur détail en premier.`}
                      >
                        {s}%
                      </span>
                    );
                  })()}
                </div>

                {/* Display mode selector */}
                <div className="flex bg-white border border-gray-200 rounded overflow-hidden">
                  {DISPLAY_MODES.map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => updateExperience(idx, x => ({ ...x, displayMode: mode.value }))}
                      title={mode.label}
                      className={cn(
                        "px-1.5 py-0.5 text-[11px] stitch-mono transition-colors",
                        (exp.displayMode || 'normal') === mode.value
                          ? "text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                      style={(exp.displayMode || 'normal') === mode.value ? { backgroundColor: mode.color } : undefined}
                    >
                      {mode.icon}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    if (!window.confirm(`Supprimer l'expérience « ${exp.position || exp.company} » ? Cette action est définitive.`)) return;
                    setCvData(prev => prev ? {...prev, experience: prev.experience.filter((_, i) => i !== idx)} : null);
                  }}
                  className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  title="Supprimer cette expérience"
                  aria-label="Supprimer cette expérience"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* ─── Mode label ─── */}
              {(() => {
                const currentMode = DISPLAY_MODES.find(m => m.value === (exp.displayMode || 'normal'))!;
                return (
                  <div className="text-[11px] stitch-mono uppercase tracking-widest mb-1.5" style={{ color: currentMode.color }}>
                    {currentMode.label}
                  </div>
                );
              })()}

              {/* Hidden mode: show only title, collapse everything else */}
              {(exp.displayMode || 'normal') === 'hidden' ? (
                <p className="text-[11px] text-gray-600 italic line-through">{exp.position} · {exp.company}</p>
              ) : (
              <>
              <Input
                variant="bare"
                className="font-bold mb-1"
                value={exp.position}
                placeholder="Intitulé du poste"
                onChange={(e) => {
                  const position = e.target.value;
                  updateExperience(idx, x => ({ ...x, position }));
                }}
              />
              <Input
                variant="bare"
                mono={false}
                className="text-blue-600"
                value={exp.company}
                placeholder="Nom de l'entreprise"
                onChange={(e) => {
                  const company = e.target.value;
                  updateExperience(idx, x => ({ ...x, company }));
                }}
              />
              {/* ─── Company tags (stage + business model) ─── */}
              <div className="grid grid-cols-2 gap-1.5 mt-1 mb-1">
                <select
                  value={exp.companyStage || ''}
                  onChange={(e) => {
                    const companyStage = e.target.value || undefined;
                    updateExperience(idx, x => ({ ...x, companyStage }));
                  }}
                  className="text-[11px] font-mono text-gray-600 bg-gray-50/60 border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:bg-white focus:text-gray-700 cursor-pointer"
                  aria-label="Stade de l'entreprise"
                >
                  <option value="">Stade…</option>
                  {COMPANY_STAGE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <select
                  value={exp.companyBusinessModel || ''}
                  onChange={(e) => {
                    const companyBusinessModel = e.target.value || undefined;
                    updateExperience(idx, x => ({ ...x, companyBusinessModel }));
                  }}
                  className="text-[11px] font-mono text-gray-600 bg-gray-50/60 border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:bg-white focus:text-gray-700 cursor-pointer"
                  aria-label="Modèle économique"
                >
                  <option value="">Modèle…</option>
                  {COMPANY_BUSINESS_MODEL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              {/* ─── Intro (short role description) ─── */}
              <Textarea
                inputSize="xs"
                mono={false}
                className="mt-1 focus:border-blue-600"
                rows={2}
                value={exp.intro || ''}
                placeholder="Description courte du rôle (1-2 lignes, optionnel)"
                onChange={(e) => {
                  const intro = e.target.value;
                  updateExperience(idx, x => ({ ...x, intro }));
                }}
              />

              <div className="grid grid-cols-3 gap-2 mt-1">
                <Input
                  inputSize="xs"
                  className="focus:border-blue-600"
                  value={exp.start_date}
                  placeholder="Début"
                  onChange={(e) => {
                    const start_date = e.target.value;
                    updateExperience(idx, x => ({ ...x, start_date }));
                  }}
                />
                <Input
                  inputSize="xs"
                  className="focus:border-blue-600 disabled:opacity-40"
                  value={exp.end_date || ''}
                  placeholder="Fin"
                  disabled={exp.current}
                  onChange={(e) => {
                    const end_date = e.target.value;
                    updateExperience(idx, x => ({ ...x, end_date }));
                  }}
                />
                <label className="flex items-center gap-1 text-[11px] font-mono text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exp.current}
                    onChange={(e) => {
                      const current = e.target.checked;
                      updateExperience(idx, x => ({ ...x, current, end_date: current ? '' : x.end_date }));
                    }}
                    className="w-3 h-3"
                  />
                  Actuel
                </label>
              </div>

              {/* ─── KPI field (single row: label + input + visibility toggle) ─── */}
              <div className="mt-2 flex items-center gap-2">
                <label className="text-[11px] stitch-mono text-emerald-700 uppercase shrink-0">KPI</label>
                <Input
                  inputSize="xs"
                  mono={false}
                  className="flex-1 min-w-0 border-emerald-200 focus:border-emerald-500"
                  value={exp.kpi || ''}
                  placeholder="Ex: +35% de CA, 12 personnes managées..."
                  onChange={(e) => {
                    const kpi = e.target.value;
                    updateExperience(idx, x => ({ ...x, kpi }));
                  }}
                />
                <label
                  className="flex items-center gap-1 text-[11px] font-mono text-gray-600 cursor-pointer shrink-0"
                  title="Par défaut le KPI ne s'affiche qu'en mode Étendu. Coche pour forcer l'affichage quel que soit le mode."
                >
                  <input
                    type="checkbox"
                    checked={exp.showKpi === true}
                    onChange={(e) => {
                      const showKpi = e.target.checked ? true : undefined;
                      updateExperience(idx, x => ({ ...x, showKpi }));
                    }}
                    className="w-3 h-3"
                  />
                  Afficher
                </label>
              </div>

              {/* ─── Bullet points (hidden in compact mode) ─── */}
              {(exp.displayMode || 'normal') !== 'compact' && (
                <div className="space-y-1 mt-2">
                  {exp.description?.map((bullet, bIdx) => {
                    const bulletKey = `${idx}-${bIdx}`;
                    return (
                    <div key={bIdx} className="space-y-1">
                      <div className="flex items-center gap-1 group/bullet">
                        <Input
                          inputSize="xs"
                          mono={false}
                          className="flex-1 focus:border-blue-600"
                          value={bullet}
                          onChange={(e) => {
                            const text = e.target.value;
                            updateExperience(idx, x => ({
                              ...x,
                              description: x.description.map((b, i) => (i === bIdx ? text : b)),
                            }));
                          }}
                        />
                        {(() => {
                          const weak = getWeakIssues(idx, bIdx);
                          if (!weak) return null;
                          return (
                            <span
                              className="shrink-0 w-2 h-2 rounded-full bg-orange-400"
                              title={weak.issues.map(i => i.label).join(', ')}
                            />
                          );
                        })()}
                        <button
                          title="Améliorer avec l'IA"
                          aria-label="Améliorer ce point avec l'IA"
                          disabled={bullets.improvingBulletKey === (bulletKey as RewriteKey)}
                          onClick={() => bullets.requestSuggestions(bulletKey as RewriteKey, bullet, exp)}
                          className="p-1 text-gray-600 hover:text-blue-500 opacity-0 group-hover/bullet:opacity-100 focus-visible:opacity-100 transition-opacity"
                        >
                          {bullets.improvingBulletKey === (bulletKey as RewriteKey)
                            ? <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-500" />
                            : <Sparkles className="w-2.5 h-2.5" />}
                        </button>
                        <button
                          onClick={() => updateExperience(idx, x => ({
                            ...x,
                            description: x.description.filter((_, i) => i !== bIdx),
                          }))}
                          aria-label="Supprimer ce point"
                          className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover/bullet:opacity-100 focus-visible:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-2 h-2" />
                        </button>
                      </div>
                      {bullets.bulletSuggestions?.key === (bulletKey as RewriteKey) && (
                        <div className="ml-2 p-2 bg-blue-50 border border-blue-100 rounded space-y-1 animate-in fade-in duration-200">
                          <p className="text-[11px] font-mono text-blue-700 uppercase tracking-wider mb-1">Suggestions IA</p>
                          {bullets.bulletSuggestions.suggestions.map((sug, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => bullets.pickSuggestion(bulletKey as RewriteKey, sug)}
                              className="w-full text-left px-2 py-1 text-[11px] text-gray-700 hover:bg-blue-100 rounded transition-colors"
                            >
                              {sug}
                            </button>
                          ))}
                          <button
                            onClick={bullets.dismissSuggestions}
                            className="text-[11px] font-mono text-gray-600 hover:text-gray-900 mt-1"
                          >
                            Fermer
                          </button>
                        </div>
                      )}
                      {bullets.pendingRewrites.has(bulletKey as RewriteKey) && (
                        <BulletDiffView
                          original={bullets.pendingRewrites.get(bulletKey as RewriteKey)!.original}
                          rewritten={bullets.pendingRewrites.get(bulletKey as RewriteKey)!.rewritten}
                          onAccept={() => bullets.acceptRewrite(bulletKey as RewriteKey)}
                          onReject={() => bullets.rejectRewrite(bulletKey as RewriteKey)}
                        />
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={() => updateExperience(idx, x => ({
                    ...x,
                    description: [...(x.description || []), 'Nouvelle responsabilité...'],
                  }))}
                  className="text-[11px] stitch-mono text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-2 h-2" /> Ajouter un point
                </button>
              </div>
              )}

              {/* Compact mode: show summary line */}
              {(exp.displayMode || 'normal') === 'compact' && (
                <div className="mt-2">
                  <Input
                    inputSize="xs"
                    mono={false}
                    className="border-amber-200 focus:border-amber-500"
                    value={exp.description?.[0] || ''}
                    placeholder="Description synthétique du poste..."
                    onChange={(e) => {
                      const text = e.target.value;
                      updateExperience(idx, x => ({
                        ...x,
                        description: x.description?.length
                          ? x.description.map((b, i) => (i === 0 ? text : b))
                          : [text],
                      }));
                    }}
                  />
                </div>
              )}
              </>
              )}
            </div>
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
