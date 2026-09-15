import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { maskHeaderBlocks } from '../shared/lib/anonymize';
import { getUserErrorMessage } from '../shared/lib/convexError';
import { readStoredText } from '../shared/lib/storage';
import { useUser } from '@clerk/clerk-react';
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { extractKeywords, scoreExperience } from '../features/editor/lib/scoring';
import { useCVLoader, useAutoZoom, useATSAnalysis, useKeywordDistribution, useBulletOptimization, useCVPersistence, useExport, useTemplateSelection, useCoverLetter, useLanguageSwitch, useAutoSaveDraft, useEditorAI } from '../features/editor/hooks';
import { usePaginationFit } from '../features/editor/hooks/usePaginationFit';
import { useFitToPages } from '../features/editor/hooks/useFitToPages';
import { useJobRequirements } from '../features/editor/hooks/useJobRequirements';
import { getBlockRenderers } from '../features/editor/templates/blockRenderers';
import { useAutoNotification, useAccessCode, useDocumentTitle, useSecondsCounter } from '../shared/hooks';
import { EditorNotification, TemplateConfirmModal, EditorHeader, CoverLetterDrawer, LanguageRegenerateModal } from '../features/editor/components';
import { EditorPreview } from '../features/editor/components/EditorPreview';
import { EditorSidebar } from '../features/editor/components/EditorSidebar';
import { detectCVLanguage } from '../lib/languageDetection';
import { analyzeWeakBullets } from '../features/editor/lib/weakBulletDetection';

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
  const [expandedSection, setExpandedSection] = useState<string | null>('personal');
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

  const { zoom, setZoom, isAutoZoom, setIsAutoZoom, recomputeZoom } = useAutoZoom(previewContainerRef);
  const blockRenderers = useMemo(() => getBlockRenderers(selectedTemplate), [selectedTemplate]);
  const { pageAssignments: rawPageAssignments, actualPageCount, stablePageCount, hasClippedContent } = usePaginationFit(
    cvData, designSettings, selectedTemplate, isAnonymous,
  );
  const pageAssignments = useMemo(
    () => (isAnonymous && cvData ? maskHeaderBlocks(rawPageAssignments, cvData) : rawPageAssignments),
    [rawPageAssignments, isAnonymous, cvData],
  );
  const firstExperiencePage = useMemo(() => {
    const idx = pageAssignments.findIndex(p => p.blocks.some(b => b.block.type === 'experience'));
    return idx >= 0 ? idx : 0;
  }, [pageAssignments]);

  const requirements = useJobRequirements(analyzedOffer, jobDescription, getCode(), committed.id);
  // ponytail: bridge until the requirement score replaces keyword matching.
  // Years of experience are measured from dates, never matched as text.
  const aiKeywords = useMemo(
    () => requirements.filter(r => r.kind !== 'experience_years').map(r => r.label),
    [requirements],
  );
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
  // Proposals and rewrites belong to the committed offer, like the keywords they
  // are built from: keyed on the live text, a typo fixed in the offer wiped paid
  // rewrites on display.
  const keywordDistribution = useKeywordDistribution({
    cvData,
    setCvData,
    jobDescription: analyzedOffer,
    missingKeywords: missingKeywordsList,
    notify,
    accessCode: getCode(),
  });
  const bullets = useBulletOptimization({
    cvData,
    setCvData,
    jobDescription: analyzedOffer,
    missingKeywords: missingKeywordsList,
    notify,
    accessCode: getCode(),
  });
  const persistence = useCVPersistence({
    cvData,
    designSettings,
    selectedTemplate,
    jobDescription,
    user,
    isGuest,
    notify,
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
    cvData,
    designSettings,
    notify,
    isAnonymous,
    language: currentLanguage,
  });
  const ai = useEditorAI({
    cvData, setCvData, designSettings,
    jobDescription, user, isGuest, notify, accessCode: getCode(),
  });
  const { isAutoSaving, lastAutoSaveAt, saveFailed } = useAutoSaveDraft({
    cvData, designSettings, selectedTemplate, jobDescription,
    user, isGuest, updateLastCV,
  });

  // One AI action at a time: prevents concurrent rewrites clobbering each other
  const aiBusy = ai.isOptimizing || language.isRegenerating || ai.isEnriching
    || bullets.isOptimizing || keywordDistribution.isDistributing || coverLetter.isGenerating;
  // These calls answer with a whole CV that replaces the current one
  const isRewritingCV = ai.isOptimizing || language.isRegenerating || ai.isEnriching;
  const optimizeSeconds = useSecondsCounter(ai.isOptimizing);

  // Recompute zoom when the available width changes (sidebar toggle, tab).
  // cvData is deliberately NOT a dep: typing doesn't change the container
  // width, and reading clientWidth forces a layout in the same frame as the
  // pagination reconcile.
  useEffect(() => { if (isAutoZoom) recomputeZoom(); }, [isSidebarOpen, activeTab]);

  // ─── Memoized computations ───
  // Le badge de pertinence et le tri auto doivent lire la MÊME liste
  // d'exigences, sinon le pourcentage affiché ne décrit pas ce que le tri fait.
  // La liste curée (mots-clés extraits par l'IA + acronymes) est déjà calculée
  // pour le panneau ATS ; `extractKeywords` produisait à côté un sac de 36 à 60
  // termes bruts où le bruit noyait les vraies exigences. Repli sur elle
  // uniquement quand la liste curée n'est pas encore disponible.
  const jobKeywords = useMemo(() => {
    const curated = atsKeywords.keywords.map(k => k.keyword);
    return curated.length > 0 ? curated : extractKeywords(jobDescription);
  }, [atsKeywords, jobDescription]);

  // ─── Fit to the target page count ───
  const targetPages = designSettings.pageLimit ?? 2;
  const fit = useFitToPages({
    cvData, setCvData, jobKeywords, stablePageCount, targetPages,
    loadedJobDescription, jobDescription, notify,
  });

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
        designSettings={designSettings}
        setDesignSettings={setDesignSettings}
        selectedTemplate={selectedTemplate}
        jobDescription={jobDescription}
        onJobDescriptionChange={setJobDescription}
        onJobDescriptionCommit={commitJobDescription}
        actualPageCount={actualPageCount}
        hasClippedContent={hasClippedContent}
        targetPages={targetPages}
        onTargetPagesChange={(n) => setDesignSettings(prev => ({ ...prev, pageLimit: n }))}
        isFitting={fit.isFitting}
        onFitToPages={fit.runFit}
        expandedSection={expandedSection}
        toggles={toggles}
        aiBusy={aiBusy}
        isRewritingCV={isRewritingCV}
        isOptimizing={ai.isOptimizing}
        optimizeSeconds={optimizeSeconds}
        optimizeEstimate={ai.optimizeEstimate}
        onOptimize={ai.optimize}
        isEnriching={ai.isEnriching}
        onEnrich={ai.enrichExperiences}
        experienceScores={experienceScores}
        weakBullets={weakBullets}
        atsScore={atsScore}
        atsKeywords={atsKeywords}
        hasJobDescription={hasJobDescription}
        onAddSkill={handleAddSkill}
        bullets={bullets}
        keywordDistribution={keywordDistribution}
        exports={exports}
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
          onExport={exports.downloadPDF}
          isAutoSaving={isAutoSaving}
          lastAutoSaveAt={lastAutoSaveAt}
          autoSaveFailed={saveFailed}
          isSaving={persistence.isSaving}
          isExporting={exports.isExporting}
          hasCvData={!!cvData}
          atsMode={designSettings.atsMode ?? false}
          onAtsModeChange={templateSelection.setAtsMode}
          currentLanguage={currentLanguage}
          onLanguageChange={language.handleLanguageChange}
          isLanguageLocked={isRewritingCV}
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
      {exports.isExporting && (
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
        notify={notify}
      />
    </div>
  );
}
