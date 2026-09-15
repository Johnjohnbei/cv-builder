import { Download, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/src/shared/lib/cn';
import { Logo } from '@/src/shared/ui/Logo';
import { Button } from '@/src/shared/ui/Button';
import type { CVData, DesignSettings, ATSScoreResult, KeywordAnalysisResult } from '@/src/shared/types';
import type { WeakBulletResult } from '../lib/weakBulletDetection';
import { ATSPanel } from './ATSPanel';
import { PortfolioSuggestion } from './PortfolioSuggestion';
import { DistributionProposalsPanel } from './DistributionProposalsPanel';
import {
  OptimizePanel, PersonalInfoSection, SummarySection, ExperienceSection,
  SkillsSection, EducationSection, LanguagesSection, DesignTab,
} from './sections';
import type {
  useBulletOptimization, useKeywordDistribution, useExport,
  useTemplateSelection, useCoverLetter,
} from '../hooks';

export type EditorTab = 'content' | 'design' | 'ats';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;

  cvData: CVData | null;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  designSettings: DesignSettings;
  setDesignSettings: React.Dispatch<React.SetStateAction<DesignSettings>>;
  selectedTemplate: string;

  jobDescription: string;
  onJobDescriptionChange: (v: string) => void;
  actualPageCount: number;

  expandedSection: string | null;
  toggles: Record<'personal' | 'summary' | 'experience' | 'skills' | 'education' | 'languages', () => void>;

  /** True while ANY AI action runs: every AI trigger in the sidebar is disabled */
  aiBusy: boolean;
  /**
   * True while an AI call rewrites the whole CV (optimize, translate, enrich).
   * Its answer replaces the CV, so editing is suspended meanwhile: an edit
   * made during the wait used to be silently overwritten.
   */
  isRewritingCV: boolean;
  isOptimizing: boolean;
  optimizeSeconds: number;
  optimizeEstimate: number;
  onOptimize: () => void;
  /** Target page count the fit pass condenses towards */
  targetPages: number;
  onTargetPagesChange: (n: number) => void;
  isFitting: boolean;
  onFitToPages: () => void;
  isEnriching: boolean;
  onEnrich: () => void;

  experienceScores: number[];
  weakBullets: WeakBulletResult[];

  atsScore: ATSScoreResult | null;
  atsKeywords: KeywordAnalysisResult;
  hasJobDescription: boolean;
  onAddSkill: (skill: string) => void;

  bullets: ReturnType<typeof useBulletOptimization>;
  keywordDistribution: ReturnType<typeof useKeywordDistribution>;
  exports: ReturnType<typeof useExport>;
  templateSelection: ReturnType<typeof useTemplateSelection>;
  coverLetter: ReturnType<typeof useCoverLetter>;

  notify: (args: { message: string; type: 'success' | 'error' }) => void;
}

const TABS: { id: EditorTab; label: string }[] = [
  { id: 'content', label: 'Contenu' },
  { id: 'design', label: 'Design' },
  { id: 'ats', label: 'ATS' },
];

const TAB_CLASSES = 'flex-1 py-3 text-[11px] font-bold uppercase tracking-widest transition-colors';

/**
 * The editor's left panel: tab bar + the active tab's panels + the export CTA.
 *
 * Purely a shell: every piece of state lives in EditorPage, the sidebar only
 * routes it to the right section component.
 */
export function EditorSidebar(props: Props) {
  const {
    isOpen, onClose, activeTab, onTabChange,
    cvData, setCvData, designSettings, setDesignSettings, selectedTemplate,
    jobDescription, onJobDescriptionChange, actualPageCount,
    targetPages, onTargetPagesChange, isFitting, onFitToPages,
    expandedSection, toggles,
    aiBusy, isRewritingCV, isOptimizing, optimizeSeconds, optimizeEstimate, onOptimize,
    isEnriching, onEnrich, experienceScores, weakBullets,
    atsScore, atsKeywords, hasJobDescription, onAddSkill,
    bullets, keywordDistribution, exports, templateSelection, coverLetter, notify,
  } = props;

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      <aside className={cn(
        "stitch-sidebar h-screen max-h-screen overflow-hidden shrink-0 transition-all duration-300 z-50",
        "fixed md:relative inset-y-0 left-0",
        isOpen ? "w-[320px] max-w-[85vw] translate-x-0" : "w-0 -translate-x-full md:w-0"
      )}>
        <div className="stitch-header shrink-0 justify-between">
          <Link to="/dashboard">
            <Logo size="sm" />
          </Link>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Fermer le panneau latéral"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex border-b border-[#DADCE0] shrink-0" role="tablist">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                role="tab"
                aria-current={activeTab === tab.id ? 'true' : undefined}
                aria-selected={activeTab === tab.id}
                className={cn(
                  TAB_CLASSES,
                  activeTab === tab.id ? "bg-white text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {tab.label}
              </button>
            ))}
            {/* Not a tab: opens the cover letter drawer. Keeping it in activeTab
                left an empty tabpanel behind once the drawer was closed. */}
            <button
              onClick={() => coverLetter.open()}
              aria-haspopup="dialog"
              aria-expanded={coverLetter.isOpen}
              className={cn(
                TAB_CLASSES,
                coverLetter.isOpen ? "bg-white text-purple-600 border-b-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              Lettre
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 min-h-0 scrollbar-thin" role="tabpanel">
            {/* Native fieldset: one attribute disables every field and button below */}
            <fieldset disabled={isRewritingCV} className="min-w-0 space-y-4">
            {activeTab === 'content' ? (
              <div className="space-y-3">
                <OptimizePanel
                  jobDescription={jobDescription}
                  onJobDescriptionChange={onJobDescriptionChange}
                  actualPageCount={actualPageCount}
                  hasCvData={!!cvData}
                  targetPages={targetPages}
                  onTargetPagesChange={onTargetPagesChange}
                  isFitting={isFitting}
                  onFitToPages={onFitToPages}
                  aiBusy={aiBusy}
                  isOptimizing={isOptimizing}
                  optimizeSeconds={optimizeSeconds}
                  optimizeEstimate={optimizeEstimate}
                  onOptimize={onOptimize}
                />
                <PersonalInfoSection
                  personalInfo={cvData?.personal_info}
                  setCvData={setCvData}
                  expanded={expandedSection === 'personal'}
                  onToggle={toggles.personal}
                  notify={notify}
                />
                <SummarySection
                  summary={cvData?.personal_info?.summary}
                  setCvData={setCvData}
                  expanded={expandedSection === 'summary'}
                  onToggle={toggles.summary}
                />
                <ExperienceSection
                  experience={cvData?.experience}
                  setCvData={setCvData}
                  hasJobDescription={Boolean(jobDescription)}
                  experienceScores={experienceScores}
                  weakBullets={weakBullets}
                  expanded={expandedSection === 'experience'}
                  onToggle={toggles.experience}
                  aiBusy={aiBusy}
                  isEnrichingExperiences={isEnriching}
                  onEnrich={onEnrich}
                  bullets={bullets}
                />
                <SkillsSection
                  skills={cvData?.skills}
                  setCvData={setCvData}
                  expanded={expandedSection === 'skills'}
                  onToggle={toggles.skills}
                />
                <EducationSection
                  education={cvData?.education}
                  setCvData={setCvData}
                  expanded={expandedSection === 'education'}
                  onToggle={toggles.education}
                />
                <LanguagesSection
                  languages={cvData?.languages}
                  setCvData={setCvData}
                  expanded={expandedSection === 'languages'}
                  onToggle={toggles.languages}
                />
              </div>
            ) : activeTab === 'design' ? (
              <DesignTab
                designSettings={designSettings}
                setDesignSettings={setDesignSettings}
                selectedTemplate={selectedTemplate}
                onRequestTemplateChange={templateSelection.requestTemplateChange}
                actualPageCount={actualPageCount}
                onPreviewPDF={exports.previewPDF}
                onDownloadPDF={exports.downloadPDF}
                isExporting={exports.isExporting}
                onExportDocx={exports.downloadDocx}
                isExportingDocx={exports.isExportingDocx}
                onOpenCoverLetter={coverLetter.open}
              />
            ) : (
              <>
              <PortfolioSuggestion
                jobDescription={jobDescription}
                personalInfo={cvData?.personal_info}
                setCvData={setCvData}
                notify={notify}
              />
              <ATSPanel
                score={atsScore}
                keywords={atsKeywords}
                hasJobDescription={hasJobDescription}
                onAddSkill={onAddSkill}
                onIntegrateKeyword={bullets.integrateKeyword}
                onToggleAtsMode={() => templateSelection.setAtsMode(!designSettings.atsMode)}
                onOptimizeBullets={bullets.optimize}
                isOptimizing={bullets.isOptimizing}
                aiBusy={aiBusy}
                isAtsMode={designSettings.atsMode}
                integratingKeyword={bullets.integratingKeyword}
                onAutoDistribute={keywordDistribution.distribute}
                isDistributing={keywordDistribution.isDistributing}
                pendingProposalsCount={keywordDistribution.proposals.length}
                proposalsSlot={
                  keywordDistribution.proposals.length > 0 ? (
                    <DistributionProposalsPanel
                      proposals={keywordDistribution.proposals}
                      onAcceptOne={keywordDistribution.acceptOne}
                      onRejectOne={keywordDistribution.rejectOne}
                      onAcceptAll={keywordDistribution.acceptAll}
                      onRejectAll={keywordDistribution.rejectAll}
                    />
                  ) : undefined
                }
              />
              </>
            )}
            </fieldset>
          </div>
        </div>

        {/* Single export CTA: saving lives in the header (auto-save + version) */}
        <div className="p-4 border-t border-[#DADCE0] bg-white">
          <Button
            variant="primary"
            fullWidth
            className="py-2 text-[11px] normal-case tracking-normal font-medium"
            icon={exports.isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            disabled={exports.isExporting || !cvData}
            onClick={exports.downloadPDF}
          >
            Exporter en PDF
          </Button>
        </div>
      </aside>
    </>
  );
}
