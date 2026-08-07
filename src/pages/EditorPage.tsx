import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { cn } from '../shared/lib/cn';
import { maskPersonalInfo } from '../shared/lib/anonymize';
import { getUserErrorMessage } from '../shared/lib/convexError';
import { Logo } from '../shared/ui/Logo';
import { Button } from '../shared/ui/Button';
import { useUser } from '@clerk/clerk-react';
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { autoAssignModes, extractKeywords, scoreExperience } from '../features/editor/lib/scoring';
import { useCVLoader, useAutoZoom, useATSAnalysis, useKeywordDistribution, useBulletOptimization, useCVPersistence, usePDFExport, useTemplateSelection, useCoverLetter, useLanguageSwitch, useAutoSaveDraft } from '../features/editor/hooks';
import { usePaginationFit } from '../features/editor/hooks/usePaginationFit';
import { getBlockRenderers } from '../features/editor/templates/blockRenderers';
import { useAutoNotification, useAccessCode, useDocumentTitle, useSecondsCounter } from '../shared/hooks';
import { EditorNotification, TemplateConfirmModal, EditorHeader, ATSPanel, DistributionProposalsPanel, CoverLetterDrawer, LanguageRegenerateModal } from '../features/editor/components';
import { EditorPreview } from '../features/editor/components/EditorPreview';
import { OptimizePanel, PersonalInfoSection, SummarySection, ExperienceSection, SkillsSection, EducationSection, LanguagesSection, DesignTab } from '../features/editor/components/sections';
import { detectCVLanguage } from '../lib/languageDetection';
import { analyzeWeakBullets } from '../features/editor/lib/weakBulletDetection';

export default function EditorPage() {
  useDocumentTitle('Éditeur');

  // ─── Auth & API ───
  const { user } = useUser();
  const { id: cvId } = useParams<{ id: string }>();
  const isGuest = sessionStorage.getItem('guest_access') === 'true';
  const userData = useQuery(api.users.getMe, user ? undefined : "skip");
  const storeUser = useMutation(api.users.store);
  const updateLastCV = useMutation(api.users.updateLastGeneratedCV);
  const optimizeCVAction = useAction(api.ai.optimizeCVForPage);
  const extractKeywordsAction = useAction(api.ai.extractJobKeywords);
  const enrichExperienceAction = useAction(api.ai.enrichExperienceMeta);
  const [isEnrichingExperiences, setIsEnrichingExperiences] = useState(false);

  // ─── UI state ───
  const [activeTab, setActiveTab] = useState<'content' | 'design' | 'ats'>('content');
  const [expandedSection, setExpandedSection] = useState<string | null>('personal');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [jobDescription, setJobDescription] = useState('');
  const [aiKeywords, setAiKeywords] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  // ─── Refs ───
  const cvRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // ─── Custom hooks ───
  const { notification, notify, clearNotification } = useAutoNotification();
  const { getCode } = useAccessCode();
  const {
    cvData, setCvData,
    designSettings, setDesignSettings,
    selectedTemplate, setSelectedTemplate,
    isLoading, userModified, setUserModified,
    resetAutoAssign,
    loadedJobDescription,
  } = useCVLoader(user, userData, isGuest, jobDescription);

  const isTailored = Boolean(
    userData?.lastJobDescription &&
    jobDescription.trim().length > 0 &&
    userData.lastJobDescription.trim() === jobDescription.trim()
  );

  // Initialize jobDescription from loaded data (dashboard → editor flow)
  const jdInitialized = useRef(false);
  useEffect(() => {
    if (!jdInitialized.current && loadedJobDescription && !jobDescription) {
      jdInitialized.current = true;
      setJobDescription(loadedJobDescription);
    }
  }, [loadedJobDescription]);

  const { zoom, setZoom, isAutoZoom, setIsAutoZoom, recomputeZoom } = useAutoZoom(previewContainerRef);
  const blockRenderers = useMemo(() => getBlockRenderers(selectedTemplate), [selectedTemplate]);
  const { pageAssignments: rawPageAssignments, actualPageCount } = usePaginationFit(
    cvData, designSettings, selectedTemplate,
  );
  const pageAssignments = useMemo(() => {
    if (!isAnonymous || !cvData) return rawPageAssignments;
    const maskedInfo = maskPersonalInfo(cvData).personal_info;
    return rawPageAssignments.map(page => ({
      ...page,
      blocks: page.blocks.map(pb =>
        pb.block.type === 'header' ? { ...pb, block: { ...pb.block, data: maskedInfo } } : pb
      ),
      sidebarBlocks: page.sidebarBlocks?.map(pb =>
        pb.block.type === 'header' ? { ...pb, block: { ...pb.block, data: maskedInfo } } : pb
      ),
    }));
  }, [rawPageAssignments, isAnonymous, cvData]);
  const firstExperiencePage = useMemo(() => {
    const idx = pageAssignments.findIndex(p => p.blocks.some(b => b.block.type === 'experience'));
    return idx >= 0 ? idx : 0;
  }, [pageAssignments]);

  const { score: atsScore, keywords: atsKeywords, hasJobDescription } = useATSAnalysis(cvData, designSettings, jobDescription, aiKeywords);

  // Stable reference so memo(EditorPreview) can skip re-renders while the user
  // types in the sidebar (JD textarea, panel toggles...).
  const templateStyle = useMemo(() => ({
    '--primary': designSettings.primaryColor,
    '--secondary': designSettings.secondaryColor,
  } as React.CSSProperties), [designSettings.primaryColor, designSettings.secondaryColor]);

  const missingKeywordsList = useMemo(
    () => atsKeywords.keywords.filter(k => !k.found).map(k => k.keyword),
    [atsKeywords],
  );
  const keywordDistribution = useKeywordDistribution({
    cvData,
    setCvData,
    jobDescription,
    missingKeywords: missingKeywordsList,
    notify,
    accessCode: getCode(),
  });
  const bullets = useBulletOptimization({
    cvData,
    setCvData,
    jobDescription,
    missingKeywords: missingKeywordsList,
    notify,
    accessCode: getCode(),
  });
  const persistence = useCVPersistence({
    cvData,
    designSettings,
    selectedTemplate,
    user,
    isGuest,
    notify,
  });
  const pdfExport = usePDFExport({
    cvRef,
    cvData,
    designSettings,
    notify,
    isAnonymous,
  });
  const templateSelection = useTemplateSelection({
    selectedTemplate,
    setSelectedTemplate,
    designSettings,
    setDesignSettings,
    notify,
  });
  const coverLetter = useCoverLetter({
    cvData,
    jobDescription,
    isTailored,
    cvId,
    user,
    notify,
    accessCode: getCode(),
  });
  const language = useLanguageSwitch({
    cvData,
    setCvData,
    setUserModified,
    user,
    isGuest,
    jobDescription,
    updateLastCV,
    notify,
    accessCode: getCode(),
  });
  const currentLanguage = language.currentLanguage;
  const { isAutoSaving, lastAutoSaveAt } = useAutoSaveDraft({
    cvData, designSettings, selectedTemplate, jobDescription,
    user, isGuest, userModified, updateLastCV,
  });

  // One AI action at a time: prevents concurrent rewrites clobbering each other
  const aiBusy = isOptimizing || language.isRegenerating || isEnrichingExperiences
    || bullets.isOptimizing || keywordDistribution.isDistributing || coverLetter.isGenerating;
  const optimizeSeconds = useSecondsCounter(isOptimizing);
  // Same size-based estimate as the dashboard optimize flow
  const optimizeEstimate = useMemo(() => {
    if (!cvData) return 30;
    const size = JSON.stringify(cvData).length;
    return size < 3000 ? 30 : size < 6000 ? 60 : size < 10000 ? 120 : size < 15000 ? 180 : 240;
  }, [cvData]);

  // Auto-open ATS tab + extract AI keywords when JD transitions from empty to non-empty
  const prevJDRef = useRef(jobDescription);
  useEffect(() => {
    const wasEmpty = !prevJDRef.current.trim();
    const isNowFilled = jobDescription.trim().length > 0;
    if (wasEmpty && isNowFilled) {
      setActiveTab('ats');
      // Extract real keywords via AI. Cancelled if the JD changes again or the
      // page unmounts, so a stale response can't overwrite a fresher one.
      let cancelled = false;
      extractKeywordsAction({ jobDescription, accessCode: getCode() })
        .then(data => {
          if (!cancelled && data.keywords && Array.isArray(data.keywords)) {
            setAiKeywords(data.keywords);
          }
        })
        .catch(() => {}); // Fallback to NLP extraction silently
      prevJDRef.current = jobDescription;
      return () => { cancelled = true; };
    }
    prevJDRef.current = jobDescription;
  }, [jobDescription]);

  // Recompute zoom when the available width changes (sidebar toggle, tab).
  // cvData is deliberately NOT a dep: typing doesn't change the container
  // width, and reading clientWidth forces a layout in the same frame as the
  // pagination reconcile.
  useEffect(() => { if (isAutoZoom) recomputeZoom(); }, [isSidebarOpen, activeTab]);

  // ─── Memoized computations ───
  const jobKeywords = useMemo(() => extractKeywords(jobDescription), [jobDescription]);

  // One score per experience, recomputed only when experiences or keywords
  // change: inline calls in the JSX ran keywords.length regexes per experience
  // on every keystroke.
  const experienceScores = useMemo(
    () => (cvData?.experience ?? []).map(exp => scoreExperience(exp, jobKeywords)),
    [cvData?.experience, jobKeywords],
  );

  const weakBullets = useMemo(
    () => cvData ? analyzeWeakBullets(cvData.experience) : [],
    [cvData?.experience],
  );

  const toggleSection = useCallback((section: string) => {
    setExpandedSection(prev => (prev === section ? null : section));
  }, []);
  // Stable per-section toggles so memo() on the section components holds
  const togglePersonal = useCallback(() => toggleSection('personal'), [toggleSection]);
  const toggleSummary = useCallback(() => toggleSection('summary'), [toggleSection]);
  const toggleExperience = useCallback(() => toggleSection('experience'), [toggleSection]);
  const toggleSkills = useCallback(() => toggleSection('skills'), [toggleSection]);
  const toggleEducation = useCallback(() => toggleSection('education'), [toggleSection]);
  const toggleLanguages = useCallback(() => toggleSection('languages'), [toggleSection]);

  // renderCV replaced by PaginatedCV — block-based pagination engine

  const handleEnrichExperiences = async () => {
    if (!cvData?.experience || cvData.experience.length === 0) return;
    setIsEnrichingExperiences(true);
    try {
      const result = await enrichExperienceAction({
        experiences: cvData.experience.map(exp => ({
          company: exp.company,
          position: exp.position,
          intro: exp.intro,
          description: exp.description,
        })),
        accessCode: getCode(),
      });
      // Merge: only set tags where missing (don't overwrite user edits)
      const updatedExp = cvData.experience.map((exp, i) => {
        const r = result.results[i];
        if (!r) return exp;
        return {
          ...exp,
          companyStage: exp.companyStage || r.stage || undefined,
          companyBusinessModel: exp.companyBusinessModel || r.businessModel || undefined,
        };
      });
      const updated = { ...cvData, experience: updatedExp };
      setCvData(updated);
      setUserModified(true);
      // Persist new tags to the working draft so a refresh keeps them.
      if (user) {
        updateLastCV({ cvData: updated, jobDescription: jobDescription || undefined })
          .catch(e => console.warn('[handleEnrichExperiences] persist failed:', e));
      } else if (isGuest) {
        localStorage.setItem('guest_last_optimized', JSON.stringify(updated));
      }
      const filled = result.results.filter(r => r.stage || r.businessModel).length;
      notify({
        message: filled > 0
          ? `Tags détectés pour ${filled}/${cvData.experience.length} expériences`
          : 'Aucun tag détectable depuis les expériences actuelles',
        type: filled > 0 ? 'success' : 'error',
      });
    } catch (e) {
      console.error('Error enriching experiences:', e);
      notify({ message: getUserErrorMessage(e, 'Erreur lors de la détection des entreprises.'), type: 'error' });
    } finally {
      setIsEnrichingExperiences(false);
    }
  };

  const handleOptimize = async () => {
    if (!cvData) return;
    setIsOptimizing(true);
    
    try {
      const optimizedData = await optimizeCVAction({
        cvData,
        pageLimit: designSettings.pageLimit || 1,
        jobDescription: jobDescription || undefined,
        accessCode: getCode(),
      });
      
      // Update state with optimized data
      setCvData(optimizedData);
      setUserModified(true);
      notify({ message: 'CV optimisé avec succès !', type: 'success' });

      // Save automatically — persist to the user's working draft so a refresh
      // restores the optimized CV (was previously only storeUser, which doesn't
      // write cvData).
      if (user) {
        await storeUser();
        updateLastCV({ cvData: optimizedData, jobDescription: jobDescription || undefined })
          .catch(e => console.warn('[handleOptimize] persist failed:', e));
      } else if (isGuest) {
        localStorage.setItem('guest_last_optimized', JSON.stringify(optimizedData));
      }
      
    } catch (error) {
      console.error('Error optimizing CV:', error);
      notify({ message: getUserErrorMessage(error, 'Erreur lors de l\'optimisation du CV.'), type: 'error' });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleAutoAssign = useCallback(() => {
    if (!cvData) return;
    const keywords = jobKeywords;
    const autoExperiences = autoAssignModes(cvData.experience, keywords, false);
    setCvData(prev => prev ? { ...prev, experience: autoExperiences } : null);
    setUserModified(false);
    // pagination fit auto-resets on cvData change
  }, [cvData, jobKeywords, setCvData, setUserModified]);

  const handleExportDocx = useCallback(async () => {
    if (!cvData || isExportingDocx) return;
    setIsExportingDocx(true);
    try {
      const { exportToDocx } = await import('../shared/lib/export-docx');
      // Same language and same anonymization state as the preview
      const docxData = isAnonymous ? { ...cvData, personal_info: maskPersonalInfo(cvData).personal_info } : cvData;
      await exportToDocx(docxData, currentLanguage);
      notify({ message: 'Document Word téléchargé !', type: 'success' });
    } catch (e) {
      console.error('Error exporting DOCX:', e);
      notify({ message: 'Erreur lors de l\'export Word.', type: 'error' });
    } finally {
      setIsExportingDocx(false);
    }
  }, [cvData, isAnonymous, currentLanguage, notify, isExportingDocx]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-xs text-gray-500">Chargement de l'éditeur...</p>
        </div>
      </div>
    );
  }

  // Bullet optimization (rewrite/integrate/suggestions) + auto-distribute are in dedicated hooks.

  const handleAddSkill = (skill: string) => {
    if (!cvData) return;
    const skills = [...cvData.skills];
    if (skills.length > 0) {
      const firstCategory = skills[0];
      if (!firstCategory.items.includes(skill)) {
        skills[0] = { ...firstCategory, items: [...firstCategory.items, skill] };
      }
    } else {
      skills.push({ category: 'Autres', items: [skill] });
    }
    setCvData(prev => prev ? { ...prev, skills } : null);
    notify({ message: `Compétence « ${skill} » ajoutée`, type: 'success' });
  };

  return (
    <div className="stitch-container relative">
      {/* Notifications */}
      {notification && <EditorNotification message={notification.message} type={notification.type} onClose={clearNotification} />}

      {/* Confirmation Modal */}
      {templateSelection.showTemplateConfirm && (
        <TemplateConfirmModal
          pendingTemplate={templateSelection.pendingTemplate}
          onConfirm={templateSelection.confirmTemplateChange}
          onCancel={templateSelection.cancelTemplateChange}
        />
      )}

      {/* Language regeneration modal */}
      {language.pendingLanguage && cvData && (
        <LanguageRegenerateModal
          fromLang={detectCVLanguage(cvData)}
          toLang={language.pendingLanguage}
          isRegenerating={language.isRegenerating}
          onConfirm={language.handleConfirmRegenerate}
          onSwitchOnly={language.handleSwitchLabelsOnly}
          onCancel={language.handleCancelLanguageChange}
        />
      )}

      {/* Sidebar Navigation (Stitch Style) */}
      {/* Mobile overlay backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside className={cn(
        "stitch-sidebar h-screen max-h-screen overflow-hidden shrink-0 transition-all duration-300 z-50",
        "fixed md:relative inset-y-0 left-0",
        isSidebarOpen ? "w-[320px] max-w-[85vw] translate-x-0" : "w-0 -translate-x-full md:w-0"
      )}>
        <div className="stitch-header shrink-0 justify-between">
          <Link to="/dashboard">
            <Logo size="sm" />
          </Link>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Fermer la sidebar"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex border-b border-[#DADCE0] shrink-0" role="tablist">
            <button
              onClick={() => setActiveTab('content')}
              role="tab"
              aria-current={activeTab === 'content' ? 'true' : undefined}
              aria-selected={activeTab === 'content'}
              className={cn(
                "flex-1 py-3 text-[10px] stitch-mono font-bold uppercase tracking-widest transition-colors",
                activeTab === 'content' ? "bg-white text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-100"
              )}
            >
              Contenu
            </button>
            <button
              onClick={() => setActiveTab('design')}
              role="tab"
              aria-current={activeTab === 'design' ? 'true' : undefined}
              aria-selected={activeTab === 'design'}
              className={cn(
                "flex-1 py-3 text-[10px] stitch-mono font-bold uppercase tracking-widest transition-colors",
                activeTab === 'design' ? "bg-white text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-100"
              )}
            >
              Design
            </button>
            <button
              onClick={() => setActiveTab('ats')}
              role="tab"
              aria-current={activeTab === 'ats' ? 'true' : undefined}
              aria-selected={activeTab === 'ats'}
              className={cn(
                "flex-1 py-3 text-[10px] stitch-mono font-bold uppercase tracking-widest transition-colors",
                activeTab === 'ats' ? "bg-white text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-100"
              )}
            >
              ATS
            </button>
            {/* Not a tab: opens the cover letter drawer. Keeping it in activeTab
                left an empty tabpanel behind once the drawer was closed. */}
            <button
              onClick={() => coverLetter.open()}
              aria-haspopup="dialog"
              aria-expanded={coverLetter.isOpen}
              className={cn(
                "flex-1 py-3 text-[10px] stitch-mono font-bold uppercase tracking-widest transition-colors",
                coverLetter.isOpen ? "bg-white text-purple-600 border-b-2 border-purple-600" : "text-gray-500 hover:bg-gray-100"
              )}
            >
              Lettre
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 scrollbar-thin" role="tabpanel">
            {activeTab === 'content' ? (
              <div className="space-y-3">
                <OptimizePanel
                  jobDescription={jobDescription}
                  onJobDescriptionChange={setJobDescription}
                  actualPageCount={actualPageCount}
                  hasCvData={!!cvData}
                  onAutoAssign={handleAutoAssign}
                  aiBusy={aiBusy}
                  isOptimizing={isOptimizing}
                  optimizeSeconds={optimizeSeconds}
                  optimizeEstimate={optimizeEstimate}
                  onOptimize={handleOptimize}
                />

                <PersonalInfoSection
                  personalInfo={cvData?.personal_info}
                  setCvData={setCvData}
                  expanded={expandedSection === 'personal'}
                  onToggle={togglePersonal}
                  setUserModified={setUserModified}
                  notify={notify}
                />

                <SummarySection
                  summary={cvData?.personal_info?.summary}
                  setCvData={setCvData}
                  expanded={expandedSection === 'summary'}
                  onToggle={toggleSummary}
                />

                <ExperienceSection
                  experience={cvData?.experience}
                  setCvData={setCvData}
                  setUserModified={setUserModified}
                  hasJobDescription={Boolean(jobDescription)}
                  experienceScores={experienceScores}
                  weakBullets={weakBullets}
                  expanded={expandedSection === 'experience'}
                  onToggle={toggleExperience}
                  aiBusy={aiBusy}
                  isEnrichingExperiences={isEnrichingExperiences}
                  onEnrich={handleEnrichExperiences}
                  bullets={bullets}
                />

                <SkillsSection
                  skills={cvData?.skills}
                  setCvData={setCvData}
                  expanded={expandedSection === 'skills'}
                  onToggle={toggleSkills}
                />

                <EducationSection
                  education={cvData?.education}
                  setCvData={setCvData}
                  expanded={expandedSection === 'education'}
                  onToggle={toggleEducation}
                />

                <LanguagesSection
                  languages={cvData?.languages}
                  setCvData={setCvData}
                  expanded={expandedSection === 'languages'}
                  onToggle={toggleLanguages}
                />
              </div>
            ) : activeTab === 'design' ? (
              <DesignTab
                designSettings={designSettings}
                setDesignSettings={setDesignSettings}
                selectedTemplate={selectedTemplate}
                onRequestTemplateChange={templateSelection.requestTemplateChange}
                actualPageCount={actualPageCount}
                onPreviewPDF={pdfExport.previewPDF}
                onDownloadPDF={pdfExport.downloadPDF}
                isExporting={pdfExport.isExporting}
                onExportDocx={handleExportDocx}
                isExportingDocx={isExportingDocx}
                onOpenCoverLetter={coverLetter.open}
              />
            ) : activeTab === 'ats' ? (
              <ATSPanel
                score={atsScore}
                keywords={atsKeywords}
                hasJobDescription={hasJobDescription}
                onAddSkill={handleAddSkill}
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
            ) : null}
          </div>
        </div>

        {/* Single export CTA: saving lives in the header (auto-save + version) */}
        <div className="p-4 border-t border-[#DADCE0] bg-white">
          <Button
            variant="primary"
            fullWidth
            className="py-2 text-[11px] normal-case tracking-normal font-medium"
            icon={pdfExport.isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            disabled={pdfExport.isExporting || !cvData}
            onClick={pdfExport.downloadPDF}
          >
            Exporter en PDF
          </Button>
        </div>
      </aside>

      {/* Main Preview Area (Stitch Style) */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#F1F3F4] min-h-0 relative">
        <EditorHeader
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          zoom={zoom}
          isAutoZoom={isAutoZoom}
          onZoomIn={() => { setZoom(prev => Math.min(150, prev + 10)); setIsAutoZoom(false); }}
          onZoomOut={() => { setZoom(prev => Math.max(30, prev - 10)); setIsAutoZoom(false); }}
          onToggleAutoZoom={() => setIsAutoZoom(prev => !prev)}
          onSave={persistence.saveDraft}
          onExport={pdfExport.downloadPDF}
          isAutoSaving={isAutoSaving}
          lastAutoSaveAt={lastAutoSaveAt}
          isSaving={persistence.isSaving}
          isExporting={pdfExport.isExporting}
          hasCvData={!!cvData}
          atsMode={designSettings.atsMode ?? false}
          onAtsModeChange={templateSelection.setAtsMode}
          currentLanguage={currentLanguage}
          onLanguageChange={language.handleLanguageChange}
          isAnonymous={isAnonymous}
          onToggleAnonymous={() => setIsAnonymous(prev => !prev)}
        />

        <EditorPreview
          ref={previewContainerRef}
          cvRootRef={cvRef}
          hasCvData={!!cvData}
          pageAssignments={pageAssignments}
          designSettings={designSettings}
          language={currentLanguage}
          blockRenderers={blockRenderers}
          selectedTemplate={selectedTemplate}
          templateStyle={templateStyle}
          firstExperiencePage={firstExperiencePage}
          zoom={zoom}
        />
      </main>

      {/* PDF generation overlay */}
      {pdfExport.isExporting && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[300]">
          <div className="bg-white rounded-lg px-6 py-4 flex items-center gap-3 shadow-lg">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-sm text-gray-700">Generation du PDF...</span>
          </div>
        </div>
      )}

      {/* Cover letter drawer */}
      <CoverLetterDrawer
        controller={coverLetter}
        user={user}
        cvName={cvData?.personal_info?.name}
        personalInfo={cvData?.personal_info}
        language={currentLanguage}
      />
    </div>
  );
}
