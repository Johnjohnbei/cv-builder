import { useState, useRef, useEffect, useMemo } from 'react';
import { Download, Eye, Save, Loader2, FileText, User, Plus, Trash2, ChevronDown, ChevronUp, Briefcase, GraduationCap, Award, Languages, AlignLeft, Sparkles, X, Zap, ArrowLeft, Mail } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { cn } from '../shared/lib/cn';
import { maskPersonalInfo } from '../shared/lib/anonymize';
import { Logo } from '../shared/ui/Logo';
import { Input } from '../shared/ui/Input';
import { Textarea } from '../shared/ui/Textarea';
import { Select } from '../shared/ui/Select';
import { Button } from '../shared/ui/Button';
import { useUser } from '@clerk/clerk-react';
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DISPLAY_MODES, SKILL_DISPLAY_MODES } from '../features/editor/lib/displayModes';
import { autoAssignModes, extractKeywords, scoreExperience } from '../features/editor/lib/scoring';
import { useCVLoader, useAutoZoom, useATSAnalysis, useKeywordDistribution, useBulletOptimization, useCVPersistence, usePDFExport, useTemplateSelection, useCoverLetter, type RewriteKey } from '../features/editor/hooks';
import { usePaginationFit } from '../features/editor/hooks/usePaginationFit';
import { PaginatedCV } from '../features/editor/components/PaginatedCV';
import { getBlockRenderers } from '../features/editor/templates/blockRenderers';
import { useAutoNotification, useAccessCode, useDocumentTitle } from '../shared/hooks';
import { EditorNotification, TemplateConfirmModal, OverflowIndicator, EditorHeader, ATSPanel, BulletDiffView, DistributionProposalsPanel, CoverLetterDrawer, LanguageRegenerateModal } from '../features/editor/components';
import { detectCVLanguage, getCVLanguage } from '../lib/languageDetection';
import { COMPANY_STAGE_OPTIONS, COMPANY_BUSINESS_MODEL_OPTIONS } from '@/convex/_ai/schemas';
import { analyzeWeakBullets } from '../features/editor/lib/weakBulletDetection';
import { TEMPLATE_ATS_COMPAT } from '../features/editor/lib/atsRules';
import type { DesignSettings } from '../shared/types';

// ─── Typed option arrays (avoid `as any` on DesignSettings union props) ───
type FontFamily = DesignSettings['fontFamily'];
type FontWeight = NonNullable<DesignSettings['sectionTitleWeight']>;
type TitleTransform = NonNullable<DesignSettings['sectionTitleTransform']>;
type TitleSpacing = NonNullable<DesignSettings['sectionTitleSpacing']>;
type PaperSize = NonNullable<DesignSettings['paperSize']>;
type Orientation = NonNullable<DesignSettings['orientation']>;

const FONT_OPTIONS: ReadonlyArray<{ id: FontFamily; name: string }> = [
  { id: 'sans', name: 'Inter (Sans)' },
  { id: 'serif', name: 'Georgia (Serif)' },
  { id: 'mono', name: 'JetBrains (Mono)' },
  { id: 'playfair', name: 'Playfair (Display)' },
  { id: 'outfit', name: 'Outfit (Modern)' },
];
const TITLE_WEIGHTS: ReadonlyArray<FontWeight> = ['normal', 'medium', 'semibold', 'bold', 'black'];
const TITLE_TRANSFORMS: ReadonlyArray<TitleTransform> = ['none', 'uppercase', 'capitalize'];
const TITLE_SPACINGS: ReadonlyArray<TitleSpacing> = ['tight', 'normal', 'wide', 'wider', 'widest'];

interface ColorTheme { name: string; p: string; s: string; f: FontFamily }
const COLOR_THEMES: ReadonlyArray<ColorTheme> = [
  { name: 'Corporate', p: '#1e293b', s: '#64748b', f: 'sans' },
  { name: 'Creative', p: '#f97316', s: '#0f172a', f: 'outfit' },
  { name: 'Elegant', p: '#111827', s: '#94a3b8', f: 'playfair' },
  { name: 'Tech', p: '#2563eb', s: '#475569', f: 'mono' },
];

const TEMPLATE_NAMES: Record<string, string> = {
  TEMPLATE_A: 'Classic',
  TEMPLATE_B: 'Modern',
  TEMPLATE_C: 'Minimal',
  TEMPLATE_E: 'Elegant',
};

export default function EditorPage() {
  useDocumentTitle('Éditeur');

  // ─── Auth & API ───
  const { user } = useUser();
  const { id: cvId } = useParams<{ id: string }>();
  const isGuest = sessionStorage.getItem('guest_access') === 'true';
  const userData = useQuery(api.users.getMe, user ? undefined : "skip");
  const storeUser = useMutation(api.users.store);
  const optimizeCVAction = useAction(api.ai.optimizeCVForPage);
  const extractKeywordsAction = useAction(api.ai.extractJobKeywords);
  const enrichExperienceAction = useAction(api.ai.enrichExperienceMeta);
  const [isEnrichingExperiences, setIsEnrichingExperiences] = useState(false);

  // ─── UI state ───
  const [activeTab, setActiveTab] = useState<'content' | 'design' | 'ats' | 'lettre'>('content');
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

  // Auto-open ATS tab + extract AI keywords when JD transitions from empty to non-empty
  const prevJDRef = useRef(jobDescription);
  useEffect(() => {
    const wasEmpty = !prevJDRef.current.trim();
    const isNowFilled = jobDescription.trim().length > 0;
    if (wasEmpty && isNowFilled) {
      setActiveTab('ats');
      // Extract real keywords via AI
      extractKeywordsAction({ jobDescription, accessCode: getCode() })
        .then(data => {
          if (data.keywords && Array.isArray(data.keywords)) {
            setAiKeywords(data.keywords);
          }
        })
        .catch(() => {}); // Fallback to NLP extraction silently
    }
    prevJDRef.current = jobDescription;
  }, [jobDescription]);

  // Recompute zoom when tab or data changes
  useEffect(() => { if (isAutoZoom) recomputeZoom(); }, [cvData, activeTab]);

  // ─── Memoized computations ───
  const jobKeywords = useMemo(() => extractKeywords(jobDescription), [jobDescription]);

  const weakBullets = useMemo(
    () => cvData ? analyzeWeakBullets(cvData.experience) : [],
    [cvData?.experience],
  );

  const getWeakIssues = (expIdx: number, bulIdx: number) =>
    weakBullets.find(w => w.expIndex === expIdx && w.bulletIndex === bulIdx);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // renderCV replaced by PaginatedCV — block-based pagination engine

  // ─── Language: single source of truth derived from cvData ───
  const currentLanguage: 'fr' | 'en' = cvData ? getCVLanguage(cvData) : 'fr';

  const applyLanguageOverride = (lang: 'fr' | 'en') => {
    setCvData(prev => prev ? { ...prev, languageOverride: lang } : prev);
    setUserModified(true);
  };

  const handleLanguageChange = (lang: 'fr' | 'en') => {
    if (!cvData || lang === currentLanguage) return;
    const contentLang = detectCVLanguage(cvData);
    if (contentLang !== lang) {
      // Content is in a different language than the one user picked → ask
      setPendingLanguage(lang);
      return;
    }
    applyLanguageOverride(lang);
  };

  const handleConfirmRegenerate = async () => {
    if (!cvData || !pendingLanguage) return;
    setIsRegeneratingLang(true);
    try {
      const optimizedData = await optimizeCVAction({
        cvData: { ...cvData, languageOverride: pendingLanguage },
        pageLimit: designSettings.pageLimit || 1,
        jobDescription: jobDescription || undefined,
        accessCode: getCode(),
      });
      setCvData({ ...optimizedData, languageOverride: pendingLanguage, detectedLanguage: pendingLanguage });
      setUserModified(true);
      notify({ message: 'CV régénéré dans la nouvelle langue !', type: 'success' });
      setPendingLanguage(null);
    } catch (error) {
      console.error('Error regenerating CV in new language:', error);
      notify({ message: 'Erreur lors de la régénération du CV.', type: 'error' });
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
      setCvData(prev => prev ? { ...prev, experience: updatedExp } : null);
      setUserModified(true);
      const filled = result.results.filter(r => r.stage || r.businessModel).length;
      notify({
        message: filled > 0
          ? `Tags détectés pour ${filled}/${cvData.experience.length} expériences`
          : 'Aucun tag détectable depuis les expériences actuelles',
        type: filled > 0 ? 'success' : 'error',
      });
    } catch (e) {
      console.error('Error enriching experiences:', e);
      notify({ message: 'Erreur lors de la détection des entreprises.', type: 'error' });
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
      notify({ message: 'CV optimisé avec succès !', type: 'success' });
      
      // Save automatically
      if (user) {
        await storeUser();
      } else if (isGuest) {
        localStorage.setItem('guest_last_optimized', JSON.stringify(optimizedData));
      }
      
    } catch (error) {
      console.error('Error optimizing CV:', error);
      notify({ message: 'Erreur lors de l\'optimisation du CV.', type: 'error' });
    } finally {
      setIsOptimizing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="stitch-mono text-xs text-gray-500">LOADING_EDITOR_ASSETS...</p>
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
    notify({ message: `Competence "${skill}" ajoutee`, type: 'success' });
  };

  return (
    <div className="stitch-container relative">
      {/* Notifications */}
      {notification && <EditorNotification message={notification.message} type={notification.type} />}

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
            <button
              onClick={() => { setActiveTab('lettre'); coverLetter.open(); }}
              role="tab"
              aria-current={activeTab === 'lettre' ? 'true' : undefined}
              aria-selected={activeTab === 'lettre'}
              className={cn(
                "flex-1 py-3 text-[10px] stitch-mono font-bold uppercase tracking-widest transition-colors",
                activeTab === 'lettre' ? "bg-white text-purple-600 border-b-2 border-purple-600" : "text-gray-500 hover:bg-gray-100"
              )}
            >
              Lettre
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 scrollbar-thin" role="tabpanel">
            {activeTab === 'content' ? (
              <div className="space-y-3">
                {/* Optimization Section */}
                <section className="stitch-panel p-4 space-y-3 bg-blue-50/30 border-blue-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-600">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-[10px] stitch-mono font-bold uppercase tracking-widest">MISE_EN_PAGE</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[9px] stitch-mono text-gray-400 uppercase">Pages:</label>
                      <span className="text-[10px] stitch-mono font-bold text-blue-600">{actualPageCount}</span>
                    </div>
                  </div>

                  {/* Job description display */}
                  {jobDescription ? (
                    <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[9px] stitch-mono text-gray-600 max-h-16 overflow-y-auto">
                      <span className="font-bold text-gray-500 uppercase text-[8px]">Offre importée</span>
                      <p className="mt-1 line-clamp-3">{jobDescription.slice(0, 300)}{jobDescription.length > 300 ? '...' : ''}</p>
                    </div>
                  ) : (
                    <Textarea
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Collez l'offre d'emploi ici pour le scoring de pertinence..."
                      rows={2}
                      className="border-blue-200 rounded-lg text-[9px] focus:border-blue-400 focus:ring-blue-400"
                    />
                  )}

                  {/* Auto-assign button */}
                  <Button
                    variant="primary"
                    fullWidth
                    className="rounded-lg py-2 px-4 text-[9px] tracking-widest"
                    icon={<Zap className="w-3.5 h-3.5" />}
                    disabled={!cvData}
                    onClick={() => {
                      if (!cvData) return;
                      const keywords = jobKeywords;
                      const autoExperiences = autoAssignModes(cvData.experience, keywords, false);
                      setCvData(prev => prev ? { ...prev, experience: autoExperiences } : null);
                      setUserModified(false);
                      // pagination fit auto-resets on cvData change
                    }}
                  >
                    AUTO-ASSIGNATION
                  </Button>

                  {/* AI content optimization button */}
                  <Button
                    variant="secondary"
                    fullWidth
                    className="rounded-lg py-2 px-4 text-[9px] tracking-widest bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
                    icon={isOptimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    loading={false}
                    disabled={isOptimizing}
                    onClick={handleOptimize}
                  >
                    {isOptimizing ? 'OPTIMISATION...' : 'RÉÉCRIRE CONTENU (IA)'}
                  </Button>
                  
                  {/* Page count indicator */}
                  <OverflowIndicator
                    actualPageCount={actualPageCount}
                    hasCvData={!!cvData}
                  />
                </section>

                {/* Personal Info Section */}
                <section className="stitch-panel overflow-hidden">
                  <button 
                    onClick={() => toggleSection('personal')}
                    className="w-full stitch-panel-header flex items-center justify-between hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3" />
                      <span>01. INFOS_PERSONNELLES</span>
                    </div>
                    {expandedSection === 'personal' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {expandedSection === 'personal' && (
                    <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      <Input
                        label="Nom complet"
                        type="text"
                        value={cvData?.personal_info?.name || ''}
                        onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, name: e.target.value}} : null)}
                      />
                      <Input
                        label="Titre pro"
                        type="text"
                        value={cvData?.personal_info?.title || ''}
                        onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, title: e.target.value}} : null)}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Email"
                          type="email"
                          className="text-[10px]"
                          value={cvData?.personal_info?.email || ''}
                          onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, email: e.target.value}} : null)}
                        />
                        <Input
                          label="Téléphone"
                          type="text"
                          className="text-[10px]"
                          value={cvData?.personal_info?.phone || ''}
                          onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, phone: e.target.value}} : null)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Localisation"
                          type="text"
                          className="text-[10px]"
                          placeholder="Ex: Paris, France"
                          value={cvData?.personal_info?.location || ''}
                          onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, location: e.target.value}} : null)}
                        />
                        <Input
                          label="LinkedIn URL"
                          type="text"
                          className="text-[10px]"
                          value={cvData?.personal_info?.linkedin || ''}
                          onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, linkedin: e.target.value}} : null)}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-1">Photo de profil (URL ou Upload)</label>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            className="text-[10px] flex-1"
                            placeholder="https://..."
                            value={cvData?.personal_info?.photo_url || ''}
                            onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, photo_url: e.target.value}} : null)}
                          />
                          <label className="px-3 py-1 bg-gray-100 border border-gray-200 rounded text-[9px] stitch-mono cursor-pointer hover:bg-gray-200 transition-colors flex items-center">
                            UPLOAD
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 2 * 1024 * 1024) {
                                  notify({ message: 'Photo trop volumineuse (max 2 MB).', type: 'error' });
                                  return;
                                }
                                if (!file.type.startsWith('image/')) {
                                  notify({ message: 'Fichier non reconnu comme image.', type: 'error' });
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  const base64String = reader.result as string;
                                  setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, photo_url: base64String}} : null);
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                          </label>
                          {cvData?.personal_info?.photo_url && (
                            <button 
                              onClick={() => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, photo_url: ''}} : null)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              title="Supprimer la photo"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* Summary Section */}
                <section className="stitch-panel overflow-hidden">
                  <button 
                    onClick={() => toggleSection('summary')}
                    className="w-full stitch-panel-header flex items-center justify-between hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlignLeft className="w-3 h-3" />
                      <span>02. RÉSUMÉ_PRO</span>
                    </div>
                    {expandedSection === 'summary' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {expandedSection === 'summary' && (
                    <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      <Textarea
                        label="Résumé professionnel"
                        rows={4}
                        value={cvData?.personal_info?.summary || ''}
                        onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, summary: e.target.value}} : null)}
                        placeholder="Décrivez brièvement votre parcours et vos objectifs..."
                      />
                    </div>
                  )}
                </section>

                {/* Experience Section */}
                <section className="stitch-panel overflow-hidden">
                  <button 
                    onClick={() => toggleSection('experience')}
                    className="w-full stitch-panel-header flex items-center justify-between hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-3 h-3" />
                      <span>02. EXPERIENCES</span>
                    </div>
                    {expandedSection === 'experience' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {expandedSection === 'experience' && (
                    <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      {/* ─── Bulk auto-detect company stage + business model ─── */}
                      {cvData?.experience && cvData.experience.length > 0 && (
                        <Button
                          variant="ghost"
                          size="xs"
                          fullWidth
                          loading={isEnrichingExperiences}
                          icon={<Sparkles className="w-3 h-3" />}
                          onClick={handleEnrichExperiences}
                          className="border border-dashed border-gray-300 text-[10px] stitch-mono uppercase tracking-wider text-gray-500 hover:text-blue-600 hover:border-blue-300"
                        >
                          {isEnrichingExperiences ? 'Détection en cours…' : 'Auto-détecter stade + modèle (IA)'}
                        </Button>
                      )}
                      {cvData?.experience?.map((exp, idx) => (
                        <div key={idx} data-cv-block="experience" className="p-3 bg-gray-50 border border-[#DADCE0] rounded relative group">
                          {/* ─── Top bar: drag + mode selector + delete ─── */}
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <div className="flex items-center gap-1">
                              {/* Move up/down */}
                              <button
                                disabled={idx === 0}
                                onClick={() => {
                                  const newExp = [...(cvData?.experience || [])];
                                  [newExp[idx - 1], newExp[idx]] = [newExp[idx], newExp[idx - 1]];
                                  setCvData(prev => prev ? {...prev, experience: newExp} : null);
                                  setUserModified(true);
                                }}
                                className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors"
                                title="Monter"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                disabled={idx === (cvData?.experience?.length || 0) - 1}
                                onClick={() => {
                                  const newExp = [...(cvData?.experience || [])];
                                  [newExp[idx], newExp[idx + 1]] = [newExp[idx + 1], newExp[idx]];
                                  setCvData(prev => prev ? {...prev, experience: newExp} : null);
                                }}
                                className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors"
                                title="Descendre"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                              <span className="text-[8px] stitch-mono text-gray-400 uppercase ml-1">#{idx + 1}</span>
                              {jobDescription && (() => {
                                const s = scoreExperience(exp, jobKeywords);
                                return (
                                  <span className="text-[7px] stitch-mono ml-1 px-1 py-0.5 rounded" style={{
                                    backgroundColor: s >= 70 ? '#dcfce7' : s >= 40 ? '#fef9c3' : '#fee2e2',
                                    color: s >= 70 ? '#166534' : s >= 40 ? '#854d0e' : '#991b1b',
                                  }}>
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
                                  onClick={() => {
                                    const newExp = [...(cvData?.experience || [])];
                                    newExp[idx] = { ...newExp[idx], displayMode: mode.value };
                                    setCvData(prev => prev ? {...prev, experience: newExp} : null);
                                    setUserModified(true);
                                  }}
                                  title={mode.label}
                                  className={cn(
                                    "px-1.5 py-0.5 text-[7px] stitch-mono transition-colors",
                                    (exp.displayMode || 'normal') === mode.value
                                      ? "text-white"
                                      : "text-gray-400 hover:bg-gray-100"
                                  )}
                                  style={(exp.displayMode || 'normal') === mode.value ? { backgroundColor: mode.color } : undefined}
                                >
                                  {mode.icon}
                                </button>
                              ))}
                            </div>

                            <button 
                              onClick={() => setCvData(prev => prev ? {...prev, experience: prev.experience.filter((_, i) => i !== idx)} : null)}
                              className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          {/* ─── Mode label ─── */}
                          {(() => {
                            const currentMode = DISPLAY_MODES.find(m => m.value === (exp.displayMode || 'normal'))!;
                            return (
                              <div className="text-[7px] stitch-mono uppercase tracking-widest mb-1.5" style={{ color: currentMode.color }}>
                                {currentMode.label}
                              </div>
                            );
                          })()}

                          {/* Hidden mode: show only title, collapse everything else */}
                          {(exp.displayMode || 'normal') === 'hidden' ? (
                            <p className="text-[10px] text-gray-400 italic line-through">{exp.position} — {exp.company}</p>
                          ) : (
                          <>
                          <Input
                            variant="bare"
                            className="font-bold text-[11px] mb-1"
                            value={exp.position}
                            placeholder="Intitulé du poste"
                            onChange={(e) => {
                              const newExp = [...(cvData?.experience || [])];
                              newExp[idx].position = e.target.value;
                              setCvData(prev => prev ? {...prev, experience: newExp} : null);
                            }}
                          />
                          <Input
                            variant="bare"
                            mono={false}
                            className="text-[10px] text-blue-600"
                            value={exp.company}
                            placeholder="Nom de l'entreprise"
                            onChange={(e) => {
                              const newExp = [...(cvData?.experience || [])];
                              newExp[idx].company = e.target.value;
                              setCvData(prev => prev ? {...prev, experience: newExp} : null);
                            }}
                          />
                          {/* ─── Company tags (stage + business model) ─── */}
                          <div className="grid grid-cols-2 gap-1.5 mt-1 mb-1">
                            <select
                              value={exp.companyStage || ''}
                              onChange={(e) => {
                                const newExp = [...(cvData?.experience || [])];
                                newExp[idx] = { ...newExp[idx], companyStage: e.target.value || undefined };
                                setCvData(prev => prev ? {...prev, experience: newExp} : null);
                              }}
                              className="text-[9px] font-mono text-gray-500 bg-gray-50/60 border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:bg-white focus:text-gray-700 cursor-pointer"
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
                                const newExp = [...(cvData?.experience || [])];
                                newExp[idx] = { ...newExp[idx], companyBusinessModel: e.target.value || undefined };
                                setCvData(prev => prev ? {...prev, experience: newExp} : null);
                              }}
                              className="text-[9px] font-mono text-gray-500 bg-gray-50/60 border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:bg-white focus:text-gray-700 cursor-pointer"
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
                              const newExp = [...(cvData?.experience || [])];
                              newExp[idx] = { ...newExp[idx], intro: e.target.value };
                              setCvData(prev => prev ? {...prev, experience: newExp} : null);
                            }}
                          />

                          <div className="grid grid-cols-3 gap-2 mt-1">
                            <Input
                              inputSize="xs"
                              className="focus:border-blue-600"
                              value={exp.start_date}
                              placeholder="Début"
                              onChange={(e) => {
                                const newExp = [...(cvData?.experience || [])];
                                newExp[idx].start_date = e.target.value;
                                setCvData(prev => prev ? {...prev, experience: newExp} : null);
                              }}
                            />
                            <Input
                              inputSize="xs"
                              className="focus:border-blue-600 disabled:opacity-40"
                              value={exp.end_date || ''}
                              placeholder="Fin"
                              disabled={exp.current}
                              onChange={(e) => {
                                const newExp = [...(cvData?.experience || [])];
                                newExp[idx].end_date = e.target.value;
                                setCvData(prev => prev ? {...prev, experience: newExp} : null);
                              }}
                            />
                            <label className="flex items-center gap-1 text-[8px] font-mono text-gray-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={exp.current}
                                onChange={(e) => {
                                  const newExp = [...(cvData?.experience || [])];
                                  newExp[idx].current = e.target.checked;
                                  if (e.target.checked) newExp[idx].end_date = '';
                                  setCvData(prev => prev ? {...prev, experience: newExp} : null);
                                }}
                                className="w-3 h-3"
                              />
                              Actuel
                            </label>
                          </div>

                          {/* ─── KPI field (single row: label + input + visibility toggle) ─── */}
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-[7px] stitch-mono text-emerald-600 uppercase shrink-0">KPI</label>
                            <Input
                              inputSize="xs"
                              mono={false}
                              className="flex-1 min-w-0 border-emerald-200 focus:border-emerald-500"
                              value={exp.kpi || ''}
                              placeholder="Ex: +35% de CA, 12 personnes managées..."
                              onChange={(e) => {
                                const newExp = [...(cvData?.experience || [])];
                                newExp[idx] = { ...newExp[idx], kpi: e.target.value };
                                setCvData(prev => prev ? { ...prev, experience: newExp } : null);
                              }}
                            />
                            <label
                              className="flex items-center gap-1 text-[8px] font-mono text-gray-500 cursor-pointer shrink-0"
                              title="Par défaut le KPI ne s'affiche qu'en mode Étendu. Coche pour forcer l'affichage quel que soit le mode."
                            >
                              <input
                                type="checkbox"
                                checked={exp.showKpi === true}
                                onChange={(e) => {
                                  const newExp = [...(cvData?.experience || [])];
                                  newExp[idx] = {
                                    ...newExp[idx],
                                    showKpi: e.target.checked ? true : undefined,
                                  };
                                  setCvData(prev => prev ? { ...prev, experience: newExp } : null);
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
                                        const newExp = [...(cvData?.experience || [])];
                                        newExp[idx].description[bIdx] = e.target.value;
                                        setCvData(prev => prev ? {...prev, experience: newExp} : null);
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
                                      disabled={bullets.improvingBulletKey === (bulletKey as RewriteKey)}
                                      onClick={() => bullets.requestSuggestions(bulletKey as RewriteKey, bullet, exp)}
                                      className="p-1 text-gray-300 hover:text-blue-500 opacity-0 group-hover/bullet:opacity-100 transition-opacity"
                                    >
                                      {bullets.improvingBulletKey === (bulletKey as RewriteKey)
                                        ? <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-500" />
                                        : <Sparkles className="w-2.5 h-2.5" />}
                                    </button>
                                    <button 
                                      onClick={() => {
                                        const newExp = [...(cvData?.experience || [])];
                                        newExp[idx].description = newExp[idx].description.filter((_, i) => i !== bIdx);
                                        setCvData(prev => prev ? {...prev, experience: newExp} : null);
                                      }}
                                      className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover/bullet:opacity-100 transition-opacity"
                                    >
                                      <Trash2 className="w-2 h-2" />
                                    </button>
                                  </div>
                                  {bullets.bulletSuggestions?.key === (bulletKey as RewriteKey) && (
                                    <div className="ml-2 p-2 bg-blue-50 border border-blue-100 rounded space-y-1 animate-in fade-in duration-200">
                                      <p className="text-[8px] font-mono text-blue-500 uppercase tracking-wider mb-1">Suggestions IA</p>
                                      {bullets.bulletSuggestions.suggestions.map((sug, sIdx) => (
                                        <button
                                          key={sIdx}
                                          onClick={() => bullets.pickSuggestion(bulletKey as RewriteKey, sug)}
                                          className="w-full text-left px-2 py-1 text-[9px] text-gray-700 hover:bg-blue-100 rounded transition-colors"
                                        >
                                          {sug}
                                        </button>
                                      ))}
                                      <button
                                        onClick={bullets.dismissSuggestions}
                                        className="text-[8px] font-mono text-gray-400 hover:text-gray-600 mt-1"
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
                              onClick={() => {
                                const newExp = [...(cvData?.experience || [])];
                                newExp[idx].description = [...(newExp[idx].description || []), 'Nouvelle responsabilité...'];
                                setCvData(prev => prev ? {...prev, experience: newExp} : null);
                              }}
                              className="text-[8px] stitch-mono text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Plus className="w-2 h-2" /> AJOUTER_POINT
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
                                  const newExp = [...(cvData?.experience || [])];
                                  if (!newExp[idx].description?.length) {
                                    newExp[idx].description = [e.target.value];
                                  } else {
                                    newExp[idx].description[0] = e.target.value;
                                  }
                                  setCvData(prev => prev ? {...prev, experience: newExp} : null);
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
                        className="w-full py-2 border border-dashed border-gray-300 text-[10px] stitch-mono text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-3 h-3" /> AJOUTER_EXPERIENCE
                      </button>
                    </div>
                  )}
                </section>

                {/* Skills Section */}
                <section className="stitch-panel overflow-hidden">
                  <button 
                    onClick={() => toggleSection('skills')}
                    className="w-full stitch-panel-header flex items-center justify-between hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Award className="w-3 h-3" />
                      <span>03. COMPETENCES</span>
                    </div>
                    {expandedSection === 'skills' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {expandedSection === 'skills' && (
                    <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      {cvData?.skills?.map((cat, catIdx) => (
                        <div key={catIdx} className="space-y-2 p-3 bg-gray-50 border border-[#DADCE0] rounded relative group">
                          {/* Skill category mode selector */}
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex bg-white border border-gray-200 rounded overflow-hidden">
                              {SKILL_DISPLAY_MODES.map((mode) => (
                                <button
                                  key={mode.value}
                                  onClick={() => {
                                    const newSkills = [...(cvData?.skills || [])];
                                    newSkills[catIdx] = { ...newSkills[catIdx], displayMode: mode.value };
                                    setCvData(prev => prev ? {...prev, skills: newSkills} : null);
                                  }}
                                  title={mode.label}
                                  className={cn(
                                    "px-1.5 py-0.5 text-[7px] stitch-mono transition-colors",
                                    (cat.displayMode || 'normal') === mode.value
                                      ? "text-white" : "text-gray-400 hover:bg-gray-100"
                                  )}
                                  style={(cat.displayMode || 'normal') === mode.value ? { backgroundColor: mode.color } : undefined}
                                >
                                  {mode.icon}
                                </button>
                              ))}
                            </div>
                            <button 
                              onClick={() => setCvData(prev => prev ? {...prev, skills: prev.skills.filter((_, i) => i !== catIdx)} : null)}
                              className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          
                          {(cat.displayMode || 'normal') === 'hidden' ? (
                            <p className="text-[9px] text-gray-400 italic line-through">{cat.category}</p>
                          ) : (
                          <>
                          <Input
                            variant="bare"
                            className="font-bold text-[10px] uppercase"
                            value={cat.category}
                            placeholder="NOM_CATEGORIE"
                            onChange={(e) => {
                              const newSkills = [...(cvData?.skills || [])];
                              newSkills[catIdx].category = e.target.value;
                              setCvData(prev => prev ? {...prev, skills: newSkills} : null);
                            }}
                          />
              <div className="flex flex-wrap gap-2">
                {cat.items?.map((skill, skillIdx) => (
                  <div key={skillIdx} className="flex items-center gap-1 px-2 py-0.5 bg-white text-gray-600 text-[9px] stitch-mono rounded border border-gray-200">
                    <span>{typeof skill === 'string' ? skill : JSON.stringify(skill)}</span>
                    <button onClick={() => {
                      const newSkills = [...(cvData?.skills || [])];
                      newSkills[catIdx].items = newSkills[catIdx].items.filter((_, i) => i !== skillIdx);
                      setCvData(prev => prev ? {...prev, skills: newSkills} : null);
                    }}>
                      <Trash2 className="w-2 h-2" />
                    </button>
                  </div>
                ))}
              </div>
                          <Input
                            inputSize="xs"
                            type="text"
                            placeholder="Ajouter compétence..."
                            className="focus:border-blue-600"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = (e.target as HTMLInputElement).value;
                                if (val) {
                                  const newSkills = [...(cvData?.skills || [])];
                                  newSkills[catIdx].items = [...newSkills[catIdx].items, val];
                                  setCvData(prev => prev ? {...prev, skills: newSkills} : null);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }
                            }}
                          />
                          </>
                          )}
                        </div>
                      ))}
                      <button 
                        onClick={() => setCvData(prev => prev ? {...prev, skills: [...prev.skills, { category: 'Nouvelle Catégorie', items: [] }]} : null)}
                        className="w-full py-2 border border-dashed border-gray-300 text-[10px] stitch-mono text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-3 h-3" /> AJOUTER_CATEGORIE
                      </button>
                    </div>
                  )}
                </section>

                {/* Education Section */}
                <section className="stitch-panel overflow-hidden">
                  <button 
                    onClick={() => toggleSection('education')}
                    className="w-full stitch-panel-header flex items-center justify-between hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-3 h-3" />
                      <span>04. FORMATION</span>
                    </div>
                    {expandedSection === 'education' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {expandedSection === 'education' && (
                    <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      {cvData?.education?.map((edu, idx) => (
                        <div key={idx} className="p-3 bg-gray-50 border border-[#DADCE0] rounded relative group space-y-2">
                          <button 
                            onClick={() => setCvData(prev => prev ? {...prev, education: prev.education.filter((_, i) => i !== idx)} : null)}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <Input
                            variant="bare"
                            mono={false}
                            className="font-bold text-[11px]"
                            value={edu.degree}
                            placeholder="Diplôme"
                            onChange={(e) => {
                              const newEdu = [...(cvData?.education || [])];
                              newEdu[idx].degree = e.target.value;
                              setCvData(prev => prev ? {...prev, education: newEdu} : null);
                            }}
                          />
                          <Input
                            variant="bare"
                            mono={false}
                            className="text-[10px] text-blue-600"
                            value={edu.school}
                            placeholder="École"
                            onChange={(e) => {
                              const newEdu = [...(cvData?.education || [])];
                              newEdu[idx].school = e.target.value;
                              setCvData(prev => prev ? {...prev, education: newEdu} : null);
                            }}
                          />
                          <Input
                            variant="bare"
                            mono={false}
                            className="text-[9px] text-gray-400"
                            value={edu.end_date}
                            placeholder="Année"
                            onChange={(e) => {
                              const newEdu = [...(cvData?.education || [])];
                              newEdu[idx].end_date = e.target.value;
                              setCvData(prev => prev ? {...prev, education: newEdu} : null);
                            }}
                          />
                        </div>
                      ))}
                      <button 
                        onClick={() => setCvData(prev => prev ? {...prev, education: [...prev.education, { school: 'Nouvelle École', degree: 'Nouveau Diplôme', start_date: '2020', end_date: '2024' }]} : null)}
                        className="w-full py-2 border border-dashed border-gray-300 text-[10px] stitch-mono text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-3 h-3" /> AJOUTER_FORMATION
                      </button>
                    </div>
                  )}
                </section>

                {/* Languages Section */}
                <section className="stitch-panel overflow-hidden">
                  <button 
                    onClick={() => toggleSection('languages')}
                    className="w-full stitch-panel-header flex items-center justify-between hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Languages className="w-3 h-3" />
                      <span>05. LANGUES</span>
                    </div>
                    {expandedSection === 'languages' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {expandedSection === 'languages' && (
                    <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      {cvData?.languages?.map((lang, idx) => (
                        <div key={idx} className="p-3 bg-gray-50 border border-[#DADCE0] rounded relative group grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => setCvData(prev => prev ? {...prev, languages: prev.languages.filter((_, i) => i !== idx)} : null)}
                            className="absolute -top-2 -right-2 p-1 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <Input
                            variant="bare"
                            mono={false}
                            className="font-bold text-[11px]"
                            value={lang.name}
                            placeholder="Langue"
                            onChange={(e) => {
                              const newLang = [...(cvData?.languages || [])];
                              newLang[idx].name = e.target.value;
                              setCvData(prev => prev ? {...prev, languages: newLang} : null);
                            }}
                          />
                          <Select
                            variant="bare"
                            mono={false}
                            className="text-[10px] text-blue-600"
                            value={lang.proficiency}
                            onChange={(e) => {
                              const newLang = [...(cvData?.languages || [])];
                              newLang[idx].proficiency = e.target.value;
                              setCvData(prev => prev ? {...prev, languages: newLang} : null);
                            }}
                            options={[
                              { value: 'Natif', label: 'Natif' },
                              { value: 'Courant', label: 'Courant' },
                              { value: 'Intermédiaire', label: 'Intermédiaire' },
                              { value: 'Débutant', label: 'Débutant' },
                            ]}
                          />
                        </div>
                      ))}
                      <button 
                        onClick={() => setCvData(prev => prev ? {...prev, languages: [...prev.languages, { name: 'Nouvelle Langue', proficiency: 'Courant' }]} : null)}
                        className="w-full py-2 border border-dashed border-gray-300 text-[10px] stitch-mono text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-3 h-3" /> AJOUTER_LANGUE
                      </button>
                    </div>
                  )}
                </section>
              </div>
            ) : activeTab === 'design' ? (
              <div className="space-y-6">
                <section className="stitch-panel">
                  <div className="stitch-panel-header">01. TEMPLATE_SELECTION</div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    {[
                      { id: 'TEMPLATE_A', name: 'Classic', desc: 'Minimaliste & Efficace' },
                      { id: 'TEMPLATE_B', name: 'Modern', desc: 'Design & Impact' },
                      { id: 'TEMPLATE_C', name: 'Minimal', desc: 'Sérieux & Professionnel' },
                      { id: 'TEMPLATE_E', name: 'Elegant', desc: 'Haut de gamme' }
                    ].map((tpl) => (
                      <div 
                        key={tpl.id}
                        onClick={() => {
                          if (selectedTemplate !== tpl.id) {
                            templateSelection.requestTemplateChange(tpl.id);
                          }
                        }}
                        className={cn(
                          "stitch-panel p-2 cursor-pointer transition-all flex flex-col gap-2",
                          selectedTemplate === tpl.id ? "border-blue-600 ring-1 ring-blue-600 bg-blue-50/30" : "opacity-60 hover:opacity-100 hover:bg-gray-50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn("text-[9px] font-bold stitch-mono uppercase", selectedTemplate === tpl.id ? "text-blue-600" : "text-gray-900")}>{tpl.name}</span>
                          <div className="flex items-center gap-1">
                            {TEMPLATE_ATS_COMPAT[tpl.id] === 'full' ? (
                              <span className="text-[7px] stitch-mono font-bold px-1 py-0.5 rounded bg-green-100 text-green-700">ATS</span>
                            ) : (
                              <span className="text-[7px] stitch-mono font-bold px-1 py-0.5 rounded bg-orange-100 text-orange-600">DESIGN</span>
                            )}
                            {selectedTemplate === tpl.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                          </div>
                        </div>
                        <div className="h-12 bg-white border border-gray-100 rounded flex items-center justify-center overflow-hidden">
                           <div className={cn(
                             "w-full h-full opacity-20",
                             tpl.id === 'TEMPLATE_A' && "bg-gray-400",
                             tpl.id === 'TEMPLATE_B' && "bg-blue-400",
                             tpl.id === 'TEMPLATE_C' && "bg-indigo-400",
                             tpl.id === 'TEMPLATE_E' && "bg-emerald-400"
                           )} />
                        </div>
                        <span className="text-[7px] text-gray-400 stitch-mono uppercase leading-tight">{tpl.desc}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="stitch-panel">
                  <div className="stitch-panel-header">02. QUICK_THEMES</div>
                  <div className="p-4 grid grid-cols-2 gap-2">
                    {COLOR_THEMES.map((theme) => (
                      <button
                        key={theme.name}
                        onClick={() => setDesignSettings(prev => ({
                          ...prev,
                          primaryColor: theme.p,
                          secondaryColor: theme.s,
                          fontFamily: theme.f,
                        }))}
                        className="p-2 border border-gray-200 rounded text-[9px] stitch-mono hover:bg-gray-50 transition-all text-left flex flex-col gap-1"
                      >
                        <span className="font-bold">{theme.name}</span>
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.p }} />
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.s }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="stitch-panel">
                  <div className="stitch-panel-header">04. COLOR_PALETTE</div>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-2">Presets</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { p: '#1A73E8', s: '#5F6368' }, // Google
                          { p: '#000000', s: '#666666' }, // Noir
                          { p: '#2D3436', s: '#636E72' }, // Slate
                          { p: '#0984E3', s: '#74B9FF' }, // Blue
                          { p: '#6C5CE7', s: '#A29BFE' }, // Purple
                          { p: '#00B894', s: '#55EFC4' }, // Green
                          { p: '#D63031', s: '#FF7675' }, // Red
                        ].map((preset, i) => (
                          <button 
                            key={i}
                            onClick={() => setDesignSettings(prev => ({ ...prev, primaryColor: preset.p, secondaryColor: preset.s }))}
                            className="w-6 h-6 rounded border border-gray-200 flex overflow-hidden"
                          >
                            <div className="flex-1" style={{ backgroundColor: preset.p }} />
                            <div className="flex-1" style={{ backgroundColor: preset.s }} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-2">Primary Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={designSettings.primaryColor}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                          className="w-8 h-8 rounded cursor-pointer border-none p-0"
                        />
                        <Input
                          type="text"
                          className="text-[10px] py-1"
                          value={designSettings.primaryColor}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-2">Secondary Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={designSettings.secondaryColor}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                          className="w-8 h-8 rounded cursor-pointer border-none p-0"
                        />
                        <Input
                          type="text"
                          className="text-[10px] py-1"
                          value={designSettings.secondaryColor}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="stitch-panel">
                  <div className="stitch-panel-header">05. TYPOGRAPHY</div>
                  <div className="p-4 space-y-3">
                    {FONT_OPTIONS.map((font) => (
                      <button
                        key={font.id}
                        onClick={() => setDesignSettings(prev => ({ ...prev, fontFamily: font.id }))}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded border text-[10px] stitch-mono transition-colors",
                          designSettings.fontFamily === font.id 
                            ? "bg-blue-50 border-blue-200 text-blue-700 font-bold" 
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        {font.name}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="stitch-panel">
                  <div className="stitch-panel-header">06. SECTION_TITLES</div>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-2">Font Weight</label>
                      <div className="grid grid-cols-2 gap-2">
                        {TITLE_WEIGHTS.map((weight) => (
                          <button
                            key={weight}
                            onClick={() => setDesignSettings(prev => ({ ...prev, sectionTitleWeight: weight }))}
                            className={cn(
                              "px-2 py-1 rounded border text-[9px] stitch-mono transition-colors capitalize",
                              designSettings.sectionTitleWeight === weight 
                                ? "bg-blue-50 border-blue-200 text-blue-700 font-bold" 
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            )}
                          >
                            {weight}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-2">Transform</label>
                      <div className="grid grid-cols-3 gap-2">
                        {TITLE_TRANSFORMS.map((transform) => (
                          <button
                            key={transform}
                            onClick={() => setDesignSettings(prev => ({ ...prev, sectionTitleTransform: transform }))}
                            className={cn(
                              "px-2 py-1 rounded border text-[9px] stitch-mono transition-colors capitalize",
                              designSettings.sectionTitleTransform === transform 
                                ? "bg-blue-50 border-blue-200 text-blue-700 font-bold" 
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            )}
                          >
                            {transform}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-2">Spacing</label>
                      <div className="grid grid-cols-3 gap-2">
                        {TITLE_SPACINGS.map((spacing) => (
                          <button
                            key={spacing}
                            onClick={() => setDesignSettings(prev => ({ ...prev, sectionTitleSpacing: spacing }))}
                            className={cn(
                              "px-2 py-1 rounded border text-[9px] stitch-mono transition-colors capitalize",
                              designSettings.sectionTitleSpacing === spacing 
                                ? "bg-blue-50 border-blue-200 text-blue-700 font-bold" 
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            )}
                          >
                            {spacing}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-2">Pages & Options</label>
                      <div className="px-3 py-2 rounded border border-gray-200 bg-gray-50 text-[10px] stitch-mono text-gray-600">
                        {actualPageCount} page{actualPageCount > 1 ? 's' : ''} {actualPageCount > 2 && <span className="text-amber-600 ml-1">(les recruteurs preferent 1-2 pages)</span>}
                      </div>
                      <div className="mt-3">
                        <button
                          onClick={() => setDesignSettings(prev => ({ ...prev, showPhoto: !prev.showPhoto }))}
                          className={cn(
                            "w-full px-2 py-2 rounded border text-[9px] stitch-mono transition-colors flex items-center justify-between",
                            designSettings.showPhoto 
                              ? "bg-blue-50 border-blue-200 text-blue-700 font-bold" 
                              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                          )}
                        >
                          <span>AFFICHER_LA_PHOTO</span>
                          <div className={cn(
                            "w-8 h-4 rounded-full relative transition-colors",
                            designSettings.showPhoto ? "bg-blue-600" : "bg-gray-300"
                          )}>
                            <div className={cn(
                              "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                              designSettings.showPhoto ? "left-4.5" : "left-0.5"
                            )} />
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section data-cv-section="skills" className="stitch-panel">
                  <div className="stitch-panel-header">07. SECTIONS_VISIBLES</div>
                  <div className="p-4 space-y-2">
                    {[
                      { id: 'summary', label: 'Résumé professionnel', icon: '📝' },
                      { id: 'experience', label: 'Expériences', icon: '💼' },
                      { id: 'education', label: 'Formations', icon: '🎓' },
                      { id: 'skills', label: 'Compétences', icon: '⚡' },
                      { id: 'languages', label: 'Langues', icon: '🌍' },
                    ].map((section) => {
                      const included = designSettings.includedSections?.includes(section.id) ?? true;
                      return (
                        <button
                          key={section.id}
                          onClick={() => {
                            const current = designSettings.includedSections ?? ['personal', 'summary', 'experience', 'education', 'skills', 'languages'];
                            const updated = included
                              ? current.filter(s => s !== section.id)
                              : [...current, section.id];
                            // Always keep 'personal'
                            if (!updated.includes('personal')) updated.unshift('personal');
                            setDesignSettings(prev => ({ ...prev, includedSections: updated }));
                          }}
                          className={cn(
                            "w-full px-3 py-2 rounded border text-[10px] stitch-mono transition-colors flex items-center justify-between",
                            included
                              ? "bg-white border-gray-200 text-gray-800 hover:bg-gray-50"
                              : "bg-gray-100 border-gray-200 text-gray-400 line-through"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span>{section.icon}</span>
                            <span>{section.label}</span>
                          </span>
                          <div className={cn(
                            "w-8 h-4 rounded-full relative transition-colors",
                            included ? "bg-blue-600" : "bg-gray-300"
                          )}>
                            <div className={cn(
                              "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                              included ? "left-4.5" : "left-0.5"
                            )} />
                          </div>
                        </button>
                      );
                    })}
                    <p className="text-[9px] text-gray-400 mt-2 italic">Les sections cachées ne sont pas supprimées — elles sont juste masquées du PDF.</p>
                  </div>
                </section>

                <section className="stitch-panel">
                  <div className="stitch-panel-header">08. PDF_EXPORT_SETTINGS</div>
                  <div className="p-4 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] stitch-mono text-gray-500 uppercase block">Format</label>
                        <Select
                          inputSize="sm"
                          className="focus:border-blue-500"
                          value={designSettings.paperSize}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, paperSize: e.target.value as PaperSize }))}
                          options={[
                            { value: 'a4', label: 'A4' },
                            { value: 'letter', label: 'Letter' },
                            { value: 'legal', label: 'Legal' },
                          ]}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] stitch-mono text-gray-500 uppercase block">Orientation</label>
                        <Select
                          inputSize="sm"
                          className="focus:border-blue-500"
                          value={designSettings.orientation}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, orientation: e.target.value as Orientation }))}
                          options={[
                            { value: 'portrait', label: 'Portrait' },
                            { value: 'landscape', label: 'Paysage' },
                          ]}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-2">Sections à Inclure</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'personal', name: 'En-tête' },
                          { id: 'summary', name: 'Profil' },
                          { id: 'experience', name: 'Expériences' },
                          { id: 'education', name: 'Formation' },
                          { id: 'skills', name: 'Compétences' },
                          { id: 'languages', name: 'Langues' }
                        ].map((section) => (
                          <label key={section.id} className="flex items-center gap-2 cursor-pointer group p-2 rounded border border-gray-100 hover:bg-gray-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={designSettings.includedSections.includes(section.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setDesignSettings(prev => ({
                                    ...prev,
                                    includedSections: [...prev.includedSections, section.id]
                                  }));
                                } else {
                                  setDesignSettings(prev => ({
                                    ...prev,
                                    includedSections: prev.includedSections.filter(id => id !== section.id)
                                  }));
                                }
                              }}
                              className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-[9px] stitch-mono text-gray-600 group-hover:text-gray-900 transition-colors uppercase">
                              {section.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="stitch-panel">
                  <div className="stitch-panel-header">08. PREVIEW_EXPORT</div>
                  <div className="p-4 space-y-3">
                    <Button
                      variant="secondary"
                      fullWidth
                      className="rounded-lg py-3 px-4 text-[10px] tracking-widest border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                      icon={<Eye className="w-4 h-4" />}
                      onClick={pdfExport.previewPDF}
                    >
                      PRÉVISUALISER_PDF
                    </Button>

                    <Button
                      variant="primary"
                      fullWidth
                      className="rounded-lg py-3 px-4 text-[10px] tracking-widest shadow-md"
                      icon={pdfExport.isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      disabled={pdfExport.isExporting}
                      onClick={pdfExport.downloadPDF}
                    >
                      {pdfExport.isExporting ? 'EXPORTATION...' : 'TÉLÉCHARGER_PDF'}
                    </Button>

                    <Button
                      variant="secondary"
                      fullWidth
                      className="rounded-lg py-3 px-4 text-[10px] tracking-widest border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                      icon={<Download className="w-4 h-4" />}
                      onClick={async () => {
                        if (!cvData) return;
                        const { exportToDocx } = await import('../shared/lib/export-docx');
                        await exportToDocx(cvData);
                        notify({ message: 'DOCX téléchargé !', type: 'success' });
                      }}
                    >
                      TÉLÉCHARGER_DOCX
                    </Button>

                    <Button
                      variant="secondary"
                      fullWidth
                      className="rounded-lg py-3 px-4 text-[10px] tracking-widest border-2 border-purple-600 text-purple-600 hover:bg-purple-50"
                      icon={<Mail className="w-4 h-4" />}
                      onClick={coverLetter.open}
                    >
                      GÉNÉRER_LETTRE
                    </Button>
                  </div>
                </section>
              </div>
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

        <div className="p-4 border-t border-[#DADCE0] bg-white">
          <Button
            variant="secondary"
            fullWidth
            className="mb-2 py-2 text-[10px] normal-case tracking-normal font-medium"
            icon={persistence.isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            disabled={persistence.isSaving || !cvData}
            onClick={persistence.saveDraft}
          >
            SAVE_DRAFT
          </Button>
          <Button
            variant="primary"
            fullWidth
            className="py-2 text-[10px] normal-case tracking-normal font-medium"
            icon={pdfExport.isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            disabled={pdfExport.isExporting || !cvData}
            onClick={pdfExport.downloadPDF}
          >
            EXPORT_PDF
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
                templateStyle={{
                  '--primary': designSettings.primaryColor,
                  '--secondary': designSettings.secondaryColor,
                } as React.CSSProperties}
                firstExperiencePage={firstExperiencePage}
                renderPageWrapper={(cvPage, pageIndex, totalPages) => (
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
                )}
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
      />
    </div>
  );
}
