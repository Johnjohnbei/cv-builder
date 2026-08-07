import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Download, Loader2, FileText, X, ArrowLeft } from 'lucide-react';
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
import { useCVLoader, useAutoZoom, useATSAnalysis, useKeywordDistribution, useBulletOptimization, useCVPersistence, usePDFExport, useTemplateSelection, useCoverLetter } from '../features/editor/hooks';
import { stripPersistenceArtifacts } from '../features/editor/hooks/useCVPersistence';
import { usePaginationFit } from '../features/editor/hooks/usePaginationFit';
import { PaginatedCV } from '../features/editor/components/PaginatedCV';
import { getBlockRenderers } from '../features/editor/templates/blockRenderers';
import { useAutoNotification, useAccessCode, useDocumentTitle, useSecondsCounter } from '../shared/hooks';
import { EditorNotification, TemplateConfirmModal, EditorHeader, ATSPanel, DistributionProposalsPanel, CoverLetterDrawer, LanguageRegenerateModal } from '../features/editor/components';
import { OptimizePanel, PersonalInfoSection, SummarySection, ExperienceSection, SkillsSection, EducationSection, LanguagesSection, DesignTab } from '../features/editor/components/sections';
import { detectCVLanguage, getCVLanguage } from '../lib/languageDetection';
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
  const translateCVAction = useAction(api.ai.translateCV);
  const [isEnrichingExperiences, setIsEnrichingExperiences] = useState(false);

  // ─── UI state ───
  const [activeTab, setActiveTab] = useState<'content' | 'design' | 'ats'>('content');
  const [expandedSection, setExpandedSection] = useState<string | null>('personal');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [jobDescription, setJobDescription] = useState('');
  const [aiKeywords, setAiKeywords] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<'fr' | 'en' | null>(null);
  const [isRegeneratingLang, setIsRegeneratingLang] = useState(false);

  // ─── Refs ───
  const cvRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  // Debounce handle for the working-draft auto-save (declared early so the
  // effect that drives it can find it).
  const autoSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<Date | null>(null);

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

  // Stable references so memo(PaginatedCV) can skip re-renders while the user
  // types in the sidebar (JD textarea, panel toggles...).
  const templateStyle = useMemo(() => ({
    '--primary': designSettings.primaryColor,
    '--secondary': designSettings.secondaryColor,
  } as React.CSSProperties), [designSettings.primaryColor, designSettings.secondaryColor]);

  const renderPageWrapper = useCallback((cvPage: React.ReactNode, pageIndex: number, totalPages: number) => (
    <div
      className="cv-page-slot"
      style={{ marginBottom: pageIndex < totalPages - 1 ? '24px' : 0 }}
    >
      {/* Page label for pages 2+ — hidden in print */}
      {pageIndex > 0 && (
        <div className="cv-page-label flex items-center justify-center mb-2">
          <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider">Page {pageIndex + 1}</span>
        </div>
      )}
      {/* Scaled frame: fixed outer box + transform-scaled inner at true 210×297mm */}
      <div
        className="cv-page-frame relative shrink-0 overflow-hidden"
        style={{
          width: `${210 * (zoom / 100)}mm`,
          height: `${297 * (zoom / 100)}mm`,
        }}
      >
        <div
          className="cv-page-scale bg-white shadow-2xl border border-[#DADCE0]"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top left',
            width: '210mm',
            height: '297mm',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {cvPage}
        </div>
      </div>
    </div>
  ), [zoom]);

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

  // One AI action at a time: prevents concurrent rewrites clobbering each other
  const aiBusy = isOptimizing || isRegeneratingLang || isEnrichingExperiences
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

  // ─── Auto-save to working draft (debounced) ───
  // Persists displayMode toggles, text edits, template changes, and any other
  // mutation of cvData / designSettings / selectedTemplate to
  // users.lastGeneratedCV after 1.5s of idle. Major actions (translate,
  // optimize, enrich, save-draft) call updateLastCV synchronously and rely
  // on this effect to cover the long tail of low-level edits.
  //
  // Guarded by `userModified` so the initial hydration doesn't trigger a
  // write back to itself.
  useEffect(() => {
    if ((!user && !isGuest) || !cvData || !userModified) return;
    if (autoSaveDebounceRef.current) clearTimeout(autoSaveDebounceRef.current);
    autoSaveDebounceRef.current = setTimeout(() => {
      const merged = stripPersistenceArtifacts({
        ...cvData,
        design: { ...designSettings, template: selectedTemplate },
      });
      if (user) {
        setIsAutoSaving(true);
        updateLastCV({ cvData: merged, jobDescription: jobDescription || undefined })
          .then(() => setLastAutoSaveAt(new Date()))
          .catch((e) => console.warn('[auto-save] failed:', e))
          .finally(() => setIsAutoSaving(false));
      } else {
        // Guest: mirror to localStorage so a refresh doesn't lose edits
        localStorage.setItem('guest_last_optimized', JSON.stringify(merged));
        setLastAutoSaveAt(new Date());
      }
    }, 1500);
    return () => {
      if (autoSaveDebounceRef.current) clearTimeout(autoSaveDebounceRef.current);
    };
  }, [cvData, designSettings, selectedTemplate, jobDescription, user, isGuest, userModified, updateLastCV]);

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

  // ─── Language: single source of truth derived from cvData ───
  const currentLanguage: 'fr' | 'en' = cvData ? getCVLanguage(cvData) : 'fr';

  const applyLanguageOverride = (lang: 'fr' | 'en') => {
    setCvData(prev => prev ? { ...prev, languageOverride: lang } : prev);
    setUserModified(true);
  };

  // Snapshot of the translatable content. The photo is excluded: it is
  // identical in both languages and its base64 payload would otherwise be
  // duplicated per cached language in every auto-save (Convex doc cap ~1 MiB).
  const contentSnapshot = (d: NonNullable<typeof cvData>) => ({
    personal_info: { ...d.personal_info, photo_url: undefined },
    experience: d.experience,
    education: d.education,
    skills: d.skills,
    languages: d.languages,
  });

  // Instant swap to a language we already have cached (no LLM, no modal).
  // Snapshots the current view under its own language first, so toggling back
  // is also instant and preserves in-view edits.
  const applyCachedLanguage = (target: 'fr' | 'en') => {
    if (!cvData) return;
    const cached = cvData._translations?.[target];
    if (!cached) return;
    const currentLang = getCVLanguage(cvData);
    const updated = {
      ...cvData,
      ...cached,
      // The cached snapshot has no photo: carry the current one over
      personal_info: { ...cached.personal_info, photo_url: cvData.personal_info.photo_url },
      _translations: { ...cvData._translations, [currentLang]: contentSnapshot(cvData) },
      detectedLanguage: target,
      languageOverride: target,
    };
    setCvData(updated);
    setUserModified(true);
    if (user) {
      updateLastCV({ cvData: updated, jobDescription: jobDescription || undefined })
        .catch(e => console.warn('[applyCachedLanguage] persist failed:', e));
    } else if (isGuest) {
      localStorage.setItem('guest_last_optimized', JSON.stringify(updated));
    }
    notify({
      message: target === 'en' ? 'Version anglaise (instantané)' : 'Version française (instantané)',
      type: 'success',
    });
  };

  const handleLanguageChange = (lang: 'fr' | 'en') => {
    if (!cvData || lang === currentLanguage) return;
    // Cache hit → instant swap. We NEVER re-detect the content language with
    // franc to decide the flag is "already right": on mixed content franc lies
    // and the old code flipped the flag without translating, freezing the mix.
    if (cvData._translations?.[lang]) {
      applyCachedLanguage(lang);
      return;
    }
    // No cached version → confirm a real translation (LLM call).
    setPendingLanguage(lang);
  };

  const handleConfirmRegenerate = async () => {
    if (!cvData || !pendingLanguage) return;
    const currentLang = getCVLanguage(cvData);

    // Snapshot of the current view content (photo excluded, cf. contentSnapshot).
    // Cached under the current language so toggling back is free.
    const currentSnapshot = contentSnapshot(cvData);

    // Defensive: if a cache appeared meanwhile, swap instantly instead of
    // burning an LLM call (handleLanguageChange normally catches this first).
    if (cvData._translations?.[pendingLanguage]) {
      applyCachedLanguage(pendingLanguage);
      setPendingLanguage(null);
      return;
    }

    // SLOW PATH: first time translating to this language → call LLM, cache
    // both directions so the next toggle is free.
    setIsRegeneratingLang(true);
    try {
      const translatedData = await translateCVAction({
        cvData,
        targetLanguage: pendingLanguage,
        accessCode: getCode(),
      });
      const translatedSnapshot = contentSnapshot(translatedData);
      const updated = {
        ...translatedData,
        // Keep the current photo whatever the LLM returned for it
        personal_info: { ...translatedData.personal_info, photo_url: cvData.personal_info.photo_url },
        _translations: {
          ...cvData._translations,
          [currentLang]: currentSnapshot,
          [pendingLanguage]: translatedSnapshot,
        },
        detectedLanguage: pendingLanguage,
        languageOverride: pendingLanguage,
      };
      setCvData(updated);
      setUserModified(true);
      // Persist the new translation + cache to the working draft so a refresh
      // doesn't lose the work. Optimistic: don't block UI on the mutation.
      if (user) {
        updateLastCV({ cvData: updated, jobDescription: jobDescription || undefined })
          .catch(e => console.warn('[handleConfirmRegenerate slow-path] persist failed:', e));
      } else if (isGuest) {
        localStorage.setItem('guest_last_optimized', JSON.stringify(updated));
      }
      notify({ message: 'CV traduit ! Vous pouvez désormais basculer entre les langues instantanément.', type: 'success' });
      setPendingLanguage(null);
    } catch (error) {
      console.error('Error translating CV:', error);
      notify({ message: getUserErrorMessage(error, 'Erreur lors de la traduction du CV.'), type: 'error' });
    } finally {
      setIsRegeneratingLang(false);
    }
  };

  const handleSwitchLabelsOnly = () => {
    if (!pendingLanguage) return;
    applyLanguageOverride(pendingLanguage);
    setPendingLanguage(null);
  };

  const handleCancelLanguageChange = () => {
    setPendingLanguage(null);
  };

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
    if (!cvData) return;
    try {
      const { exportToDocx } = await import('../shared/lib/export-docx');
      // Same language and same anonymization state as the preview
      const docxData = isAnonymous ? { ...cvData, personal_info: maskPersonalInfo(cvData).personal_info } : cvData;
      await exportToDocx(docxData, currentLanguage);
      notify({ message: 'Document Word téléchargé !', type: 'success' });
    } catch (e) {
      console.error('Error exporting DOCX:', e);
      notify({ message: 'Erreur lors de l\'export Word.', type: 'error' });
    }
  }, [cvData, isAnonymous, currentLanguage, notify]);

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
      {pendingLanguage && cvData && (
        <LanguageRegenerateModal
          fromLang={detectCVLanguage(cvData)}
          toLang={pendingLanguage}
          isRegenerating={isRegeneratingLang}
          onConfirm={handleConfirmRegenerate}
          onSwitchOnly={handleSwitchLabelsOnly}
          onCancel={handleCancelLanguageChange}
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
          onLanguageChange={handleLanguageChange}
          isAnonymous={isAnonymous}
          onToggleAnonymous={() => setIsAnonymous(prev => !prev)}
        />

        <div
          ref={previewContainerRef}
          className="flex-1 overflow-auto p-4 sm:p-8 lg:p-12 flex flex-col items-center min-h-0 relative scroll-smooth bg-[#F1F3F4]"
        >
          {cvData && pageAssignments.length > 0 ? (
            /* Single-tree preview — one PaginatedCV, preview chrome injected via renderPageWrapper.
               In print mode, the wrapper visuals are neutralized by @media print rules. */
            <div ref={cvRef} data-cv-root className="flex flex-col items-center" style={{ marginBottom: '100px' }}>
              <PaginatedCV
                pageAssignments={pageAssignments}
                designSettings={designSettings}
                language={currentLanguage}
                blockRenderers={blockRenderers}
                selectedTemplate={selectedTemplate}
                templateStyle={templateStyle}
                firstExperiencePage={firstExperiencePage}
                renderPageWrapper={renderPageWrapper}
              />
            </div>
          ) : (
            /* Empty state */
            <div
              style={{
                width: `${210 * (zoom / 100)}mm`,
                height: `${297 * (zoom / 100)}mm`,
              }}
              className="relative shrink-0 shadow-2xl border border-[#DADCE0] bg-white flex items-center justify-center"
            >
              <div className="text-center max-w-sm p-8">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-sm font-bold text-gray-700 mb-2">Aucun CV chargé</h3>
                <p className="text-xs text-gray-500 mb-6">Importez un CV depuis le dashboard ou créez-en un nouveau pour commencer l'édition.</p>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour au dashboard
                </Link>
              </div>
            </div>
          )}
        </div>
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
