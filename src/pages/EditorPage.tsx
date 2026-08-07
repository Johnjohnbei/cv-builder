import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { maskPersonalInfo } from '../shared/lib/anonymize';
import { getUserErrorMessage } from '../shared/lib/convexError';
import { useUser } from '@clerk/clerk-react';
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { autoAssignModes, extractKeywords, scoreExperience } from '../features/editor/lib/scoring';
import { useCVLoader, useAutoZoom, useATSAnalysis, useKeywordDistribution, useBulletOptimization, useCVPersistence, usePDFExport, useTemplateSelection, useCoverLetter, useLanguageSwitch, useAutoSaveDraft, useEditorAI } from '../features/editor/hooks';
import { usePaginationFit } from '../features/editor/hooks/usePaginationFit';
import { getBlockRenderers } from '../features/editor/templates/blockRenderers';
import { useAutoNotification, useAccessCode, useDocumentTitle, useSecondsCounter } from '../shared/hooks';
import { EditorNotification, TemplateConfirmModal, EditorHeader, CoverLetterDrawer, LanguageRegenerateModal } from '../features/editor/components';
import { EditorPreview } from '../features/editor/components/EditorPreview';
import { EditorSidebar } from '../features/editor/components/EditorSidebar';
import { detectCVLanguage } from '../lib/languageDetection';
import { analyzeWeakBullets } from '../features/editor/lib/weakBulletDetection';
import { readCachedKeywords, writeCachedKeywords } from '../features/editor/lib/aiKeywordCache';

export default function EditorPage() {
  useDocumentTitle('Éditeur');

  // ─── Auth & API ───
  const { user } = useUser();
  const { id: cvId } = useParams<{ id: string }>();
  const isGuest = sessionStorage.getItem('guest_access') === 'true';
  const userData = useQuery(api.users.getMe, user ? undefined : "skip");
  const updateLastCV = useMutation(api.users.updateLastGeneratedCV);
  const extractKeywordsAction = useAction(api.ai.extractJobKeywords);

  // ─── UI state ───
  const [activeTab, setActiveTab] = useState<'content' | 'design' | 'ats'>('content');
  const [expandedSection, setExpandedSection] = useState<string | null>('personal');
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
  const ai = useEditorAI({
    cvData, setCvData, setUserModified, designSettings,
    jobDescription, user, isGuest, notify, accessCode: getCode(),
  });
  const { isAutoSaving, lastAutoSaveAt } = useAutoSaveDraft({
    cvData, designSettings, selectedTemplate, jobDescription,
    user, isGuest, userModified, updateLastCV,
  });

  // One AI action at a time: prevents concurrent rewrites clobbering each other
  const aiBusy = ai.isOptimizing || language.isRegenerating || ai.isEnriching
    || bullets.isOptimizing || keywordDistribution.isDistributing || coverLetter.isGenerating;
  const optimizeSeconds = useSecondsCounter(ai.isOptimizing);

  // Auto-open ATS tab + extract AI keywords when JD transitions from empty to non-empty
  const prevJDRef = useRef(jobDescription);
  useEffect(() => {
    const wasEmpty = !prevJDRef.current.trim();
    const isNowFilled = jobDescription.trim().length > 0;
    if (wasEmpty && isNowFilled) {
      setActiveTab('ats');
      prevJDRef.current = jobDescription;

      // Same job description as last time: reuse the cached keywords instead
      // of spending another LLM call on an input that has not changed.
      const cached = readCachedKeywords(jobDescription);
      if (cached) {
        setAiKeywords(cached);
        return;
      }

      // Cancelled if the JD changes again or the page unmounts, so a stale
      // response can't overwrite a fresher one.
      let cancelled = false;
      extractKeywordsAction({ jobDescription, accessCode: getCode() })
        .then(data => {
          if (!cancelled && data.keywords && Array.isArray(data.keywords)) {
            setAiKeywords(data.keywords);
            writeCachedKeywords(jobDescription, data.keywords);
          }
        })
        .catch(() => {}); // Fallback to NLP extraction silently
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
  const toggles = useMemo(() => ({
    personal: () => toggleSection('personal'),
    summary: () => toggleSection('summary'),
    experience: () => toggleSection('experience'),
    skills: () => toggleSection('skills'),
    education: () => toggleSection('education'),
    languages: () => toggleSection('languages'),
  }), [toggleSection]);

  // renderCV replaced by PaginatedCV — block-based pagination engine

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

      <EditorSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        cvData={cvData}
        setCvData={setCvData}
        setUserModified={setUserModified}
        designSettings={designSettings}
        setDesignSettings={setDesignSettings}
        selectedTemplate={selectedTemplate}
        jobDescription={jobDescription}
        onJobDescriptionChange={setJobDescription}
        actualPageCount={actualPageCount}
        expandedSection={expandedSection}
        toggles={toggles}
        aiBusy={aiBusy}
        isOptimizing={ai.isOptimizing}
        optimizeSeconds={optimizeSeconds}
        optimizeEstimate={ai.optimizeEstimate}
        onOptimize={ai.optimize}
        onAutoAssign={handleAutoAssign}
        isEnriching={ai.isEnriching}
        onEnrich={ai.enrichExperiences}
        experienceScores={experienceScores}
        weakBullets={weakBullets}
        atsScore={atsScore}
        atsKeywords={atsKeywords}
        hasJobDescription={hasJobDescription}
        onAddSkill={handleAddSkill}
        onExportDocx={handleExportDocx}
        isExportingDocx={isExportingDocx}
        bullets={bullets}
        keywordDistribution={keywordDistribution}
        pdfExport={pdfExport}
        templateSelection={templateSelection}
        coverLetter={coverLetter}
        notify={notify}
      />

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
