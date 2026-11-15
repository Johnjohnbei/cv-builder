import { X } from 'lucide-react';
import { cn } from '@/src/shared/lib/cn';
import type { CVData, DesignSettings } from '@/src/shared/types';
import type { WeakBulletResult } from '../lib/weak-bullet-detection';
import { ATSPanel, type ATSPanelProps } from './ATSPanel';
import { PortfolioSuggestion } from './PortfolioSuggestion';
import { offerTitleOf } from '../lib/portfolio-variants';
import {
  OfferAndPagesPanel, PersonalInfoSection, SummarySection, ExperienceSection,
  SkillsSection, EducationSection, LanguagesSection, DesignTab,
} from './sections';
import type { useExport } from '../hooks';

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

  jobDescription: string;
  onJobDescriptionChange: (v: string) => void;
  onJobDescriptionCommit: () => void;
  actualPageCount: number;
  hasClippedContent: boolean;
  /** Blank left at the bottom of the last page, in millimetres */
  lastPageFreeMm: number;

  /** The sections open in the Contenu tab: several can be open at once */
  expandedSections: ReadonlySet<string>;
  toggles: Record<'personal' | 'summary' | 'experience' | 'skills' | 'education' | 'languages', () => void>;

  /** True while ANY AI action runs: every AI trigger in the sidebar is disabled */
  aiBusy: boolean;
  /**
   * True while an AI call rewrites the whole CV (a translation not cached yet).
   * Its answer replaces the CV, so editing is suspended meanwhile: an edit
   * made during the wait used to be silently overwritten.
   */
  isRewritingCV: boolean;
  /** Target page count the fit pass condenses towards */
  targetPages: number;
  /** False while the budget is the one read from the CV's dates */
  isPageLimitChosen: boolean;
  onTargetPagesChange: (n: number) => void;
  isFitting: boolean;
  onFitToPages: () => void;

  experienceScores: number[];
  weakBullets: WeakBulletResult[];

  /** Everything the ATS tab shows and acts on, straight from useATSAnalysis */
  ats: ATSPanelProps;

  exports: ReturnType<typeof useExport>;

  notify: (args: { message: string; type: 'success' | 'error' }) => void;
}

const TABS: { id: EditorTab; label: string }[] = [
  { id: 'content', label: 'Contenu' },
  { id: 'design', label: 'Mise en page' },
  { id: 'ats', label: 'À corriger' },
];

const TAB_CLASSES = 'flex-1 min-w-0 px-2 py-3 text-xs font-medium transition-colors';

/**
 * The editor's panels and persistent page/export validation state.
 *
 * Purely a shell: every piece of state lives in EditorPage, the sidebar only
 * routes it to the right section component.
 */
export function EditorSidebar(props: Props) {
  const {
    isOpen, onClose, activeTab, onTabChange,
    cvData, setCvData, designSettings, setDesignSettings,
    jobDescription, onJobDescriptionChange, onJobDescriptionCommit, actualPageCount, hasClippedContent, lastPageFreeMm,
    targetPages, isPageLimitChosen, onTargetPagesChange, isFitting, onFitToPages,
    expandedSections, toggles,
    aiBusy, isRewritingCV, experienceScores, weakBullets,
    ats, exports, notify,
  } = props;

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="absolute inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        // Replié, le panneau garde sa largeur nulle mais pas son contenu : sans
        // `inert`, dix contrôles invisibles restaient dans l'ordre de tabulation
        inert={!isOpen}
        className={cn(
        // dvh, pas vh : le bas du panneau passait sous la barre d'adresse mobile
        "stitch-sidebar h-full max-h-full overflow-hidden shrink-0 transition-all duration-300 z-50",
        "absolute md:relative inset-y-0 left-0",
        isOpen ? "w-[320px] max-w-[85vw] translate-x-0" : "w-0 -translate-x-full md:w-0"
      )}>
        <div className="stitch-header shrink-0 justify-between">
          <span className="text-sm font-semibold">Réglages du CV</span>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            aria-label="Fermer le panneau latéral"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex border-b border-[#DADCE0] shrink-0">
            {/* role="tablist" ne porte que les onglets : le bouton « Lettre »,
                qui ouvre un tiroir, est à côté et non dedans */}
            <div className="flex w-full" role="tablist" aria-label="Édition du CV">
            {TABS.map(tab => (
              <button
                key={tab.id}
                id={`editor-tab-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                role="tab"
                tabIndex={activeTab === tab.id ? 0 : -1}
                onKeyDown={event => {
                  const index = TABS.findIndex(item => item.id === tab.id);
                  const next = event.key === 'ArrowRight' ? (index + 1) % TABS.length : event.key === 'ArrowLeft' ? (index + TABS.length - 1) % TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : -1;
                  if (next < 0) return;
                  event.preventDefault();
                  onTabChange(TABS[next].id);
                  document.getElementById(`editor-tab-${TABS[next].id}`)?.focus();
                }}
                aria-controls="editor-tabpanel"
                aria-selected={activeTab === tab.id}
                className={cn(
                  TAB_CLASSES,
                  activeTab === tab.id ? "bg-white text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {tab.label}
              </button>
            ))}
            </div>

          </div>

          <div
            id="editor-tabpanel"
            role="tabpanel"
            aria-labelledby={`editor-tab-${activeTab}`}
            className="flex-1 overflow-y-auto p-4 min-h-0 scrollbar-thin"
          >
            {/* Native fieldset: one attribute disables every field and button below */}
            <fieldset disabled={isRewritingCV} className="min-w-0 space-y-4">
              <legend className="sr-only">Contenu du CV</legend>
            {activeTab === 'content' ? (
              <div className="space-y-3">

                {/* The preview edits the same data as these fields: said here,
                    because nothing else tells you the CV itself is clickable */}
                <p className="text-[11px] text-gray-600 px-1">
                  Cliquez un texte du CV, à droite, pour le modifier à l'endroit où il se lit.
                  Ctrl+Z annule.
                </p>
              <PortfolioSuggestion
                jobDescription={jobDescription}
                offerTitle={offerTitleOf(ats.analysis.report?.requirements.map(c => c.requirement) ?? [])}
                personalInfo={cvData?.personal_info}
                setCvData={setCvData}
                notify={notify}
              />

                <PersonalInfoSection
                  personalInfo={cvData?.personal_info}
                  setCvData={setCvData}
                  expanded={expandedSections.has('personal')}
                  onToggle={toggles.personal}
                  notify={notify}
                />
                <SummarySection
                  summary={cvData?.personal_info?.summary}
                  versions={cvData?.personal_info?.versions?.summary}
                  setCvData={setCvData}
                  expanded={expandedSections.has('summary')}
                  onToggle={toggles.summary}
                />
                <ExperienceSection
                  experience={cvData?.experience}
                  setCvData={setCvData}
                  experienceScores={experienceScores}
                  weakBullets={weakBullets}
                  expanded={expandedSections.has('experience')}
                  onToggle={toggles.experience}
                />
                <SkillsSection
                  skills={cvData?.skills}
                  setCvData={setCvData}
                  expanded={expandedSections.has('skills')}
                  onToggle={toggles.skills}
                />
                <EducationSection
                  education={cvData?.education}
                  setCvData={setCvData}
                  expanded={expandedSections.has('education')}
                  onToggle={toggles.education}
                />
                <LanguagesSection
                  languages={cvData?.languages}
                  setCvData={setCvData}
                  expanded={expandedSections.has('languages')}
                  onToggle={toggles.languages}
                />
              </div>
            ) : activeTab === 'design' ? (
              <div className="space-y-4">
                <OfferAndPagesPanel
                  jobDescription={jobDescription}
                  onJobDescriptionChange={onJobDescriptionChange}
                  onJobDescriptionCommit={onJobDescriptionCommit}
                  actualPageCount={actualPageCount}
                  hasClippedContent={hasClippedContent}
                  lastPageFreeMm={lastPageFreeMm}
                  hasCvData={!!cvData}
                  targetPages={targetPages}
                  isPageLimitChosen={isPageLimitChosen}
                  onTargetPagesChange={onTargetPagesChange}
                  isFitting={isFitting}
                  onFitToPages={onFitToPages}
                />
              <DesignTab designSettings={designSettings} setDesignSettings={setDesignSettings} actualPageCount={actualPageCount} />
              </div>
            ) : (
              <>
              <ATSPanel {...ats} />
              </>
            )}
            </fieldset>
          </div>
        </div>

        <div className="shrink-0 p-3 border-t border-[#DADCE0] bg-white text-xs text-gray-600" role="status">
          {actualPageCount} page{actualPageCount > 1 ? 's' : ''} · objectif {targetPages}
          {hasClippedContent && <p className="text-red-700">Du contenu est coupé : ajustez la mise en page.</p>}
          {exports.validation && <p className={exports.validation.valid ? 'text-green-700' : 'text-red-700'}>
            {exports.validation.valid && exports.validation.checkedFile ? 'Dernier export : fichier PDF contrôlé.' : 'Dernier export : contrôle non validé.'}
          </p>}
        </div>
      </aside>
    </>
  );
}
