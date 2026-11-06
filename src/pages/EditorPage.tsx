import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { maskHeaderBlocks } from '../shared/lib/anonymize';
import { readStoredText } from '../shared/lib/storage';
import { useUser } from '@clerk/clerk-react';
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { computeRequirementMatch } from '../features/editor/lib/scoring';
import { isWritable } from '../features/editor/lib/keyword-analysis';
import { isRequirementsSettled } from '../features/editor/lib/job-requirements-cache';
import { dismissedIdsOf, requirementsOfOffer, withoutDismissed } from '../features/editor/lib/dismissed-requirements';
import { useCVLoader, useAutoZoom, useATSAnalysis, useCVPersistence, useExport, useCoverLetter, useLanguageSwitch, useAutoSaveDraft, useInPlaceEditing } from '../features/editor/hooks';
import { usePaginationFit } from '../features/editor/hooks/usePaginationFit';
import { useFitToPages } from '../features/editor/hooks/useFitToPages';
import { useJobRequirements } from '../features/editor/hooks/useJobRequirements';
import { getBlockRenderers } from '../features/editor/templates/blockRenderers';
import { useAutoNotification, useAccessCode, useDocumentTitle } from '../shared/hooks';
import { EditorNotification, EditorHeader, CoverLetterDrawer, LanguageRegenerateModal } from '../features/editor/components';
import { EditorPreview } from '../features/editor/components/EditorPreview';
import { EditorSidebar } from '../features/editor/components/EditorSidebar';
import { detectCVLanguage } from '../lib/language-detection';
import { analyzeWeakBullets } from '../features/editor/lib/weak-bullet-detection';
import { suggestedPageLimit } from '../features/editor/lib/experience-years';

export default function EditorPage() {
  useDocumentTitle('Éditeur');

  // ─── Auth & API ───
  const { user } = useUser();
  const { id: cvId } = useParams<{ id: string }>();
  const isGuest = readStoredText('guest_access', 'session') === 'true';
  const userData = useQuery(api.users.getMe, user ? undefined : "skip");
  const updateLastCV = useMutation(api.users.updateLastGeneratedCV);

  // ─── UI state ───
  const [activeTab, setActiveTab] = useState<'content' | 'design' | 'ats'>('content');
  // Several sections open at once: experiences and skills were exclusive, so
  // comparing them meant closing one to read the other
  const [expandedSections, setExpandedSections] = useState<ReadonlySet<string>>(() => new Set(['personal']));
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [jobDescription, setJobDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

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
    isLoading,
    loadedJobDescription,
    corrections,
  } = useCVLoader(user, userData, isGuest);

  const isTailored = Boolean(
    userData?.lastJobDescription &&
    jobDescription.trim().length > 0 &&
    userData.lastJobDescription.trim() === jobDescription.trim()
  );

  // Initialize jobDescription from loaded data (dashboard → editor flow)
  // The offer the AI requirements describe: committed on load and when the offer
  // field loses focus, not at every keystroke (see useJobRequirements).
  // Each commit gets a new id, same text included: a failed extraction is
  // retried at the next commit, which an identical string alone never triggered.
  const [committed, setCommitted] = useState({ offer: '', id: 0 });
  const analyzedOffer = committed.offer;
  const commitOffer = useCallback((offer: string) => setCommitted(c => ({ offer, id: c.id + 1 })), []);
  const commitJobDescription = useCallback(() => commitOffer(jobDescription), [commitOffer, jobDescription]);

  const jdInitialized = useRef(false);
  useEffect(() => {
    if (!jdInitialized.current && loadedJobDescription && !jobDescription) {
      jdInitialized.current = true;
      setJobDescription(loadedJobDescription);
      commitOffer(loadedJobDescription);
      // The score this offer makes available lives in the ATS tab. Only for an
      // offer that arrives: switching on the first character typed unmounted
      // the field being typed in.
      setActiveTab('ats');
    }
  }, [loadedJobDescription]);

  const { requirements: analyzed, status: requirementsStatus, error: requirementsError } = useJobRequirements(analyzedOffer, jobDescription, getCode(), committed.id);
  // What the offer really asks: an entry the user says is none (a contract, a
  // benefit, the recruiting company's name) leaves the list, so it leaves the
  // score's denominator, the badges and the fit pass at once
  const requirements = useMemo(() => requirementsOfOffer(cvData, analyzed), [cvData, analyzed]);
  // The CV as it prints and is measured: a requirement the user said they lack is left out of it
  const printedCV = useMemo(() => (cvData ? withoutDismissed(cvData) : null), [cvData]);
  // What the CV still claims: the fit pass protects and the badges count these only.
  // Both measure the printed CV; the fit pass writes display modes back on cvData, never printed texts.
  const claimedRequirements = useMemo(() => {
    const dismissedIds = dismissedIdsOf(cvData);
    return requirements.filter(r => !dismissedIds.includes(r.id));
  }, [requirements, cvData]);

  const { zoom, setZoom, isAutoZoom, setIsAutoZoom, recomputeZoom } = useAutoZoom(previewContainerRef);
  const blockRenderers = useMemo(() => getBlockRenderers(selectedTemplate), [selectedTemplate]);
  const { pageAssignments: rawPageAssignments, actualPageCount, stablePageCount, hasClippedContent, lastPageFreeMm } = usePaginationFit(
    printedCV, designSettings, selectedTemplate, isAnonymous,
  );
  const pageAssignments = useMemo(
    () => (isAnonymous && printedCV ? maskHeaderBlocks(rawPageAssignments, printedCV) : rawPageAssignments),
    [rawPageAssignments, isAnonymous, printedCV],
  );
  const firstExperiencePage = useMemo(() => {
    const idx = pageAssignments.findIndex(p => p.blocks.some(b => b.block.type === 'experience'));
    return idx >= 0 ? idx : 0;
  }, [pageAssignments]);

  const atsAnalysis = useATSAnalysis({ cvData, printedCV, setCvData, designSettings, requirements });

  // Stable reference so memo(EditorPreview) can skip re-renders while the user
  // types in the sidebar (JD textarea, panel toggles...).
  const templateStyle = useMemo(() => ({
    '--primary': designSettings.primaryColor,
    '--secondary': designSettings.secondaryColor,
  } as React.CSSProperties), [designSettings.primaryColor, designSettings.secondaryColor]);

  const persistence = useCVPersistence({
    cvData,
    designSettings,
    selectedTemplate,
    jobDescription,
    user,
    isGuest,
    notify,
  });
  const coverLetter = useCoverLetter({
    // The letter speaks of the CV as it prints: never of a requirement the user said they lack
    cvData: printedCV,
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
    user,
    isGuest,
    jobDescription,
    updateLastCV,
    notify,
    accessCode: getCode(),
  });
  const currentLanguage = language.currentLanguage;
  // Declared after useLanguageSwitch: the .docx section titles follow whatever
  // language the CV is currently showing.
  const exports = useExport({
    cvRef,
    cvData: printedCV,
    designSettings,
    notify,
    isAnonymous,
    language: currentLanguage,
  });
  // One AI action at a time: prevents concurrent rewrites clobbering each other
  const aiBusy = language.isRegenerating || coverLetter.isGenerating;
  // A translation not cached yet answers with a whole CV that replaces the current one
  const isRewritingCV = language.isRegenerating;

  // Recompute zoom when the available width changes (sidebar toggle, tab).
  // cvData is deliberately NOT a dep: typing doesn't change the container
  // width, and reading clientWidth forces a layout in the same frame as the
  // pagination reconcile.
  useEffect(() => { if (isAutoZoom) recomputeZoom(); }, [isSidebarOpen, activeTab]);

  // ─── Fit to the target page count ───
  // The relevance badge and the fit pass read the SAME requirements, with the
  // same matching, as the ATS score. No local guess while they are expected:
  // the fit waits for them (an offer being typed or analyzed).
  // Read from the CV's own dates when the user has not set it: a two-page
  // budget on a three-year career spreads what would read better on one
  const targetPages = designSettings.pageLimit ?? suggestedPageLimit(cvData?.experience ?? []);
  const fit = useFitToPages({
    cvData, printedCV, setCvData, requirements: claimedRequirements,
    requirementsReady: isRequirementsSettled(requirementsStatus),
    stablePageCount, targetPages, loadedJobDescription, jobDescription, notify,
  });
  const { isAutoSaving, lastAutoSaveAt, saveFailed } = useAutoSaveDraft({
    cvData, designSettings, selectedTemplate, jobDescription,
    user, isGuest, updateLastCV, paused: fit.isFitting,
  });

  // The badge of each experience: the share of the provable requirements it evidences, none without them
  const experienceScores = useMemo(
    () => claimedRequirements.some(isWritable)
      ? (printedCV?.experience ?? []).map(exp => computeRequirementMatch(exp, claimedRequirements, currentLanguage))
      : [],
    [printedCV?.experience, claimedRequirements, currentLanguage],
  );

  const { editing, undo, canUndo } = useInPlaceEditing({ cvData, setCvData });

  // What the code corrected by itself when the CV was loaded, said once
  const correctionsTold = useRef(false);
  useEffect(() => {
    if (correctionsTold.current || corrections.length === 0) return;
    correctionsTold.current = true;
    notify({ message: `Corrigé automatiquement : ${corrections.join(', ')}.`, type: 'success' });
  }, [corrections]);

  const weakBullets = useMemo(
    () => cvData ? analyzeWeakBullets(cvData.experience) : [],
    [cvData?.experience],
  );

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (!next.delete(section)) next.add(section);
      return next;
    });
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

  return (
    <div className="stitch-container relative">
      {/* Notifications */}
      {notification && <EditorNotification message={notification.message} type={notification.type} onClose={clearNotification} />}

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
        designSettings={designSettings}
        setDesignSettings={setDesignSettings}
        jobDescription={jobDescription}
        onJobDescriptionChange={setJobDescription}
        onJobDescriptionCommit={commitJobDescription}
        actualPageCount={actualPageCount}
        hasClippedContent={hasClippedContent}
        lastPageFreeMm={lastPageFreeMm}
        targetPages={targetPages}
        isPageLimitChosen={designSettings.pageLimit !== undefined}
        onTargetPagesChange={(n) => setDesignSettings(prev => ({ ...prev, pageLimit: n }))}
        isFitting={fit.isFitting}
        onFitToPages={fit.runFit}
        expandedSections={expandedSections}
        toggles={toggles}
        aiBusy={aiBusy}
        isRewritingCV={isRewritingCV}
        experienceScores={experienceScores}
        weakBullets={weakBullets}
        ats={{
          analysis: atsAnalysis,
          hasJobDescription: jobDescription.trim().length > 0,
          requirementsStatus,
          requirementsError,
          onRetryAnalysis: commitJobDescription,
          aiBusy,
        }}
        exports={exports}
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
          onExport={exports.downloadPDF}
          isAutoSaving={isAutoSaving}
          lastAutoSaveAt={lastAutoSaveAt}
          autoSaveFailed={saveFailed}
          isFitting={fit.isFitting}
          isSaving={persistence.isSaving}
          isExporting={exports.isExporting}
          hasCvData={!!cvData}
          currentLanguage={currentLanguage}
          onLanguageChange={language.handleLanguageChange}
          isLanguageLocked={isRewritingCV}
          isAnonymous={isAnonymous}
          onToggleAnonymous={() => setIsAnonymous(prev => !prev)}
          onUndo={undo}
          canUndo={canUndo}
        />

        <EditorPreview
          ref={previewContainerRef}
          cvRootRef={cvRef}
          hasCvData={!!cvData}
          pageAssignments={pageAssignments}
          designSettings={designSettings}
          language={currentLanguage}
          blockRenderers={blockRenderers}
          templateStyle={templateStyle}
          firstExperiencePage={firstExperiencePage}
          zoom={zoom}
          editing={editing}
        />
      </main>

      {/* PDF generation overlay */}
      {exports.isExporting && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[300]">
          <div className="bg-white rounded-lg px-6 py-4 flex items-center gap-3 shadow-lg">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-sm text-gray-700">Génération du PDF...</span>
          </div>
        </div>
      )}

      {/* Cover letter drawer */}
      <CoverLetterDrawer
        controller={coverLetter}
        user={user}
        cvName={cvData?.personal_info?.name}
        personalInfo={cvData?.personal_info}
        notify={notify}
      />
    </div>
  );
}
