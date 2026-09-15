import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Plus, Loader2, User, LayoutDashboard, Calendar, Trash2, ExternalLink, Sparkles, Settings, LogOut } from 'lucide-react';
import { cn } from '../shared/lib/cn';
import { getErrorCode, getUserErrorMessage } from '../shared/lib/convexError';
import { Logo } from '../shared/ui/Logo';
import { useUser } from '@clerk/clerk-react';
import { useQuery, useMutation, useAction } from "convex/react";
import type { FileRejection } from 'react-dropzone';
import { Button } from '../shared/ui/Button';
import { Dialog } from '../shared/ui/Dialog';
import { Input } from '../shared/ui/Input';
import { Notification } from '../shared/ui/Notification';
import { AccessCodeDialog } from '../features/auth/components/AccessCodeDialog';
import { AdminCodesDialog } from '../features/auth/components/AdminCodesDialog';
import { useLeaveSession } from '../features/auth/useLeaveSession';
import { api } from "@/convex/_generated/api";
import { CVData, DesignSettings, EMPTY_CV } from '../shared/types';
import {
  readStoredJSON, readStoredText, STORAGE_FAILED_MESSAGE, writeStoredText, writeStoredTexts,
} from '../shared/lib/storage';
import { replacesDraft, stripPersistenceArtifacts } from '../features/editor/hooks/useCVPersistence';

/**
 * Saved CV list entry — minimal UI-facing shape. Intentionally narrow: we
 * only type the fields the dashboard render actually reads. Covers both
 * Convex Doc<"cvs"> (authenticated) and localStorage entries (guest mode)
 * via structural compatibility — both paths provide at least these fields.
 */
interface SavedCVEntry {
  _id: string;
  createdAt: string | number;
  personal_info: { name: string; email: string; title?: string };
  design?: { template?: string };
  /** The offer the version was saved with; absent on versions saved before it was kept */
  jobDescription?: string;
}
// pdfjs (~450 kB) only loads when a PDF is actually dropped
const loadPdfTools = () => Promise.all([
  import('../lib/pdfTextExtract'),
  import('../lib/linkedinParser'),
] as const);
import { useAccessCode, useAutoNotification, useDocumentTitle, useSecondsCounter } from '../shared/hooks';

/** PDFs above this size are refused at the drop zone, before any parsing */
const MAX_PDF_BYTES = 10 * 1024 * 1024;
import { detectCVLanguage } from '../lib/languageDetection';
import { attachBilingualCache } from '../lib/bilingual';
import { withSuggestedPortfolio } from '../features/editor/lib/portfolioVariants';
import { writeCachedRequirements } from '../features/editor/lib/jobRequirementsCache';
import { templateName } from '../features/editor/lib/pagination/templateLayouts';



export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const navigate = useNavigate();
  const { user } = useUser();
  const isGuest = readStoredText('guest_access', 'session') === 'true';
  
  const [isUploading, setIsUploading] = useState(false);
  const [baseCV, setBaseCV] = useState<CVData | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [isExtractingJob, setIsExtractingJob] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const generatingSeconds = useSecondsCounter(isGenerating);
  const [activeView, setActiveView] = useState<'console' | 'cvs'>('console');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const isAdmin = user?.primaryEmailAddress?.emailAddress === 'joaudran@gmail.com';
  const [savedCVs, setSavedCVs] = useState<SavedCVEntry[]>([]);

  // Shared owner: errors stay 10 s (the dashboard's own copy cleared every
  // message after 4 s, before a long one could be read) and are announced.
  const { notification, notify: setNotification, clearNotification } = useAutoNotification();
  const [cvToDelete, setCvToDelete] = useState<string | null>(null);
  const { accessCode, saveCode, getCode, clearCode } = useAccessCode();
  const [showAccessCodePrompt, setShowAccessCodePrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const leaveSession = useLeaveSession();

  /**
   * Run an AI action once the visitor may use it: a signed-in account always
   * may, a guest needs an access code, asked for here. Same rule as the server
   * (convex/_ai/auth.ts). Only the PDF import used to go through this gate: the
   * URL import, the offer PDF and the optimization sent an empty code and failed.
   */
  const requireAccessCode = (action: () => void) => {
    if (user || getCode()) {
      action();
    } else {
      setPendingAction(() => action);
      setShowAccessCodePrompt(true);
    }
  };

  const onAccessGranted = (code: string) => {
    saveCode(code);
    setShowAccessCodePrompt(false);
    pendingAction?.();
    setPendingAction(null);
  };

  const closeAccessPrompt = () => {
    setShowAccessCodePrompt(false);
    setPendingAction(null);
  };

  /** A file the drop zone refused (not a PDF, too big) used to start the extraction anyway */
  const notifyRejectedFile = (rejections: FileRejection[]) => {
    const tooBig = rejections.some(r => r.errors.some(e => e.code === 'file-too-large'));
    setNotification({
      message: tooBig ? 'Fichier trop volumineux : 10 Mo maximum.' : 'Fichier refusé : déposez un PDF.',
      type: 'error',
    });
  };

  /** Show an AI failure. A code the server refused is forgotten, so the next action asks for a new one. */
  const reportAIError = (error: unknown, fallback: string) => {
    if (getErrorCode(error)?.startsWith('ACCESS_CODE')) clearCode();
    setNotification({ message: getUserErrorMessage(error, fallback), type: 'error' });
  };

  const convexUser = useQuery(api.users.getMe, user ? undefined : "skip");
  const convexCVs = useQuery(api.cvs.listMyCVs, user ? undefined : "skip");
  
  const storeUser = useMutation(api.users.store);
  const createCV = useMutation(api.cvs.createMyCV);
  const removeCV = useMutation(api.cvs.remove);
  const updateLastCV = useMutation(api.users.updateLastGeneratedCV);
  const saveBaseCV = useMutation(api.users.saveBaseCV);

  const extractCVDataFromPDF = useAction(api.ai.extractCVDataFromPDF);
  const tailorCV = useAction(api.ai.tailorCV);
  const translateCVAction = useAction(api.ai.translateCV);
  const extractJobDescriptionFromURL = useAction(api.ai.extractJobDescriptionFromURL);
  const extractJobDescriptionFromPDF = useAction(api.ai.extractJobDescriptionFromPDF);

  // A signed-in user reads the account only: falling through to the guest copy
  // while the query loads, or because the tab still carries a guest flag,
  // showed another session's CV.
  useEffect(() => {
    if (user) {
      if (convexUser?.baseCV) setBaseCV(convexUser.baseCV);
    } else if (isGuest) {
      setBaseCV(readStoredJSON<CVData | null>('guest_base_cv', null));
    }
  }, [convexUser, user, isGuest]);

  useEffect(() => {
    if (user) {
      if (convexCVs) setSavedCVs(convexCVs);
    } else if (isGuest) {
      setSavedCVs(readStoredJSON<SavedCVEntry[]>('guest_cvs', []));
    }
  }, [convexCVs, user, isGuest]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return; // refused files are reported by onDropRejected
    const doExtract = async () => {
      setIsUploading(true);
      try {
        const [{ extractTextFromPDF }, { parseLinkedInPDF }] = await loadPdfTools();
        // 1. Try deterministic LinkedIn parser first (instant, zero API, zero cost)
        const linkedInData = await parseLinkedInPDF(file);

        let data;
        if (linkedInData) {
          // LinkedIn format detected — parsed in <1s, no API call
          data = linkedInData;
        } else {
          // Non-LinkedIn PDF — fall back to AI extraction
          const pdfText = await extractTextFromPDF(file);
          const code = getCode();
          // Sent whole: cut at 12 000 characters, a dense CV silently lost its
          // last experiences. The server refuses a text too long, with a message.
          data = await extractCVDataFromPDF({ pdfText, accessCode: code });
        }
        const imported = { ...data, detectedLanguage: detectCVLanguage(data) };
        setBaseCV(imported);

        // The import is the base the next offer is tailored from, not the draft
        // open in the editor: it must never overwrite that draft.
        if (user) {
          await storeUser();
          await saveBaseCV({ cvData: imported });
        } else if (isGuest && !writeStoredText('guest_base_cv', JSON.stringify(imported))) {
          setNotification({ message: STORAGE_FAILED_MESSAGE, type: 'error' });
        }
      } catch (error: any) {
        console.error('Extraction error:', error);
        if (error?.message === 'PDF_NO_TEXT') {
          setNotification({ message: 'Ce PDF semble être une image scannée. Veuillez utiliser un PDF généré depuis Word, Google Docs ou LinkedIn.', type: 'error' });
        } else {
          reportAIError(error, 'Erreur lors de l\'extraction du PDF. Assurez-vous que le fichier est lisible.');
        }
      } finally {
        setIsUploading(false);
      }
    };
    requireAccessCode(doExtract);
  }, [user, storeUser, accessCode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: notifyRejectedFile,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: MAX_PDF_BYTES,
  });

  const onJobDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return; // refused files are reported by onDropRejected
    requireAccessCode(async () => {
      setIsExtractingJob(true);
      try {
        const [{ extractTextFromPDF }] = await loadPdfTools();
        const pdfText = await extractTextFromPDF(file);
        const text = await extractJobDescriptionFromPDF({ pdfText, accessCode: getCode() });
        setJobDescription(text);
      } catch (error: any) {
        console.error('Job extraction error:', error);
        if (error?.message === 'PDF_NO_TEXT') {
          setNotification({ message: 'Ce PDF semble être une image scannée. Veuillez copier-coller le texte manuellement.', type: 'error' });
        } else {
          reportAIError(error, 'Erreur lors de l\'extraction de la fiche de poste.');
        }
      } finally {
        setIsExtractingJob(false);
      }
    });
  }, [user, accessCode]);

  // PDF only: a .txt was accepted here, then failed inside pdf.js with a generic error
  const { getRootProps: getJobRootProps, getInputProps: getJobInputProps, isDragActive: isJobDragActive } = useDropzone({
    onDrop: onJobDrop,
    onDropRejected: notifyRejectedFile,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: MAX_PDF_BYTES,
  });

  const crawlJobUrl = async () => {
    setIsCrawling(true);
    try {
      const text = await extractJobDescriptionFromURL({ url: jobUrl, accessCode: getCode() });
      if (!text || text.length < 50) {
        setNotification({ message: "Nous n'avons pas pu extraire suffisamment de contenu de cette URL. Les sites comme LinkedIn bloquent souvent l'accès direct : copiez-collez plutôt le texte de l'offre dans la zone prévue.", type: 'error' });
      } else {
        setJobDescription(text);
      }
    } catch (error) {
      console.error('Crawl error:', error);
      reportAIError(error, 'Erreur lors de la récupération de l\'offre via URL. Les sites protégés (comme LinkedIn) peuvent bloquer cette fonctionnalité.');
    } finally {
      setIsCrawling(false);
    }
  };

  const handleUrlCrawl = () => {
    if (!jobUrl) return;
    requireAccessCode(() => { void crawlJobUrl(); });
  };

  const handleOptimize = () => {
    if (!baseCV || !jobDescription) return;
    requireAccessCode(() => { void optimizeForOffer(); });
  };

  const optimizeForOffer = async () => {
    if (!baseCV || !jobDescription) return;
    setIsGenerating(true);

    try {
      const result = await tailorCV({ baseData: baseCV, jobDescription, accessCode: getCode() });
      // The editor opens on this offer: its requirements are already paid for
      writeCachedRequirements(jobDescription, result.requirements);
      // A CV proposed for an offer comes with the portfolio version that offer calls for
      const optimizedData = withSuggestedPortfolio(result.cv, jobDescription);
      // Eager bilingual: produce the other language now so the editor toggle is
      // instant and never shows a half-translated mix. Degrades gracefully to
      // the original single language if the translation call fails.
      const bilingualData = await attachBilingualCache(optimizedData, translateCVAction, getCode());

      if (user) {
        await storeUser();
        await updateLastCV({ cvData: bilingualData, jobDescription });
        navigate('/editor');
      } else if (isGuest) {
        // After paid calls: a full storage must say so, not "réessayez" (and pay again)
        if (!writeStoredTexts([['guest_last_optimized', JSON.stringify(bilingualData)], ['guest_last_jd', jobDescription]])) {
          setNotification({ message: STORAGE_FAILED_MESSAGE, type: 'error' });
          return;
        }
        navigate('/editor');
      }
    } catch (error) {
      console.error('Optimization error:', error);
      reportAIError(error, 'Erreur lors de l\'optimisation du CV. Veuillez réessayer.');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * The working draft, null when there is none, undefined while the account is
   * still loading. Read as "no draft", a click in that window replaced the
   * draft without asking.
   */
  const currentDraft = (): CVData | null | undefined => {
    if (!user) return readStoredJSON<CVData | null>('guest_last_optimized', null);
    return convexUser === undefined ? undefined : convexUser?.lastGeneratedCV ?? null;
  };

  /** The offer the working draft was tailored to, "" when none */
  const currentDraftOffer = (): string => user
    ? convexUser?.lastJobDescription ?? ''
    : readStoredText('guest_last_jd');

  /** Forget the imported CV where it is stored too: cleared on screen only, it came back on reload. */
  const replaceBaseCV = async () => {
    setBaseCV(null);
    try {
      if (user) {
        await saveBaseCV({ cvData: null });
      } else if (isGuest && !writeStoredText('guest_base_cv', '')) {
        setNotification({ message: STORAGE_FAILED_MESSAGE, type: 'error' });
      }
    } catch (error) {
      console.error('Replace base CV error:', error);
      setNotification({ message: getUserErrorMessage(error, 'Impossible de retirer le CV importé. Réessayez.'), type: 'error' });
    }
  };

  /** Start from a blank CV. It replaces the working draft, so ask first when there may be one. */
  const startEmptyCV = async () => {
    if (
      replacesDraft(currentDraft(), currentDraftOffer(), EMPTY_CV, '')
      && !window.confirm('Créer un CV vide remplacera votre brouillon en cours. Continuer ?')
    ) return;
    try {
      if (user) {
        await storeUser();
        // Awaited BEFORE navigating: the editor reads the draft once, on mount,
        // and used to open on the previous one. The old offer goes too.
        await updateLastCV({ cvData: EMPTY_CV, jobDescription: '' });
      } else if (isGuest && !(
        writeStoredTexts([['guest_last_optimized', JSON.stringify(EMPTY_CV)], ['guest_last_jd', '']])
      )) {
        setNotification({ message: STORAGE_FAILED_MESSAGE, type: 'error' });
        return;
      }
      navigate('/editor');
    } catch (error) {
      console.error('Empty CV error:', error);
      setNotification({ message: getUserErrorMessage(error, 'Impossible de créer le CV vide. Réessayez.'), type: 'error' });
    }
  };


  const deleteSavedCV = async () => {
    if (!cvToDelete) return;
    try {
      if (user) {
        await removeCV({ id: cvToDelete as any });
      } else if (isGuest) {
        const updatedCVs = readStoredJSON<SavedCVEntry[]>('guest_cvs', []).filter(cv => cv._id !== cvToDelete);
        if (!writeStoredText('guest_cvs', JSON.stringify(updatedCVs))) {
          setNotification({ message: STORAGE_FAILED_MESSAGE, type: 'error' });
          return;
        }
        setSavedCVs(updatedCVs);
      }
      setNotification({ message: 'CV supprimé.', type: 'success' });
    } catch (error) {
      setNotification({ message: getUserErrorMessage(error, 'Erreur lors de la suppression.'), type: 'error' });
    } finally {
      setCvToDelete(null);
    }
  };

  return (
    <div className="stitch-container">
      <AccessCodeDialog open={showAccessCodePrompt} onClose={closeAccessPrompt} onGranted={onAccessGranted} />
      {isAdmin && <AdminCodesDialog open={showAdminPanel} onClose={() => setShowAdminPanel(false)} />}
      {/* Sidebar */}
      <aside className="stitch-sidebar dashboard-sidebar flex-col w-[320px] shrink-0">
        <div className="stitch-header">
          <Logo size="sm" />
        </div>
        
        <nav className="flex-1 p-2 space-y-1">
          <button 
            onClick={() => setActiveView('console')}
            className={cn(
              "w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              activeView === 'console' ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Optimiser</span>
          </button>
          <button 
            onClick={() => setActiveView('cvs')}
            className={cn(
              "w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              activeView === 'cvs' ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <FileText className="w-4 h-4" />
            <span>Mes CV</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowAdminPanel(true)}
              className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Admin</span>
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-[#DADCE0] space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-gray-600" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">{user?.fullName || (isGuest ? 'Invité' : 'Utilisateur')}</p>
              <p className="text-[11px] text-gray-500 truncate">{user?.primaryEmailAddress?.emailAddress || (isGuest ? 'Mode local' : '')}</p>
            </div>
          </div>
          {/* The dashboard no longer sits inside Layout, whose header held the only sign-out */}
          <Button variant="ghost" size="sm" mono={false} fullWidth icon={<LogOut className="w-3.5 h-3.5" />} onClick={() => void leaveSession()}>
            {user ? 'Se déconnecter' : 'Quitter le mode invité'}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        <header className="stitch-header justify-between">
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>Calibre</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900 font-medium">Optimiseur de CV</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className={cn(
              "text-[11px] stitch-mono px-2 py-0.5 rounded border",
              user ? "text-green-700 bg-green-50 border-green-100" : "text-gray-600 bg-gray-50 border-gray-200",
            )}>
              {user ? 'Connecté' : 'Mode invité'}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 pb-20 md:pb-6">
          {activeView === 'console' ? (
            <div className="grid grid-cols-12 gap-4 lg:gap-6">
              
              {/* Left: Configuration */}
              <div className="col-span-12 lg:col-span-4 space-y-6">
                <section className="stitch-panel">
                  <div className="stitch-panel-header">1. Votre CV</div>
                  <div className="p-4">
                    {!baseCV ? (
                      <div className="space-y-3">
                        <div 
                          {...getRootProps()} 
                          className={cn(
                            "border-2 border-dashed border-[#DADCE0] rounded p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors",
                            isDragActive && "bg-blue-50 border-blue-400"
                          )}
                        >
                          <input {...getInputProps()} />
                          {isUploading ? (
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                          ) : (
                            <>
                              <Upload className="w-6 h-6 mx-auto text-gray-600 mb-2" />
                              <p className="text-xs font-medium">Importer un CV (PDF)</p>
                            </>
                          )}
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          fullWidth
                          icon={<Plus className="w-3 h-3" />}
                          className="border-dashed border-blue-300"
                          onClick={startEmptyCV}
                        >
                          Créer un CV vide
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-gray-50 border border-[#DADCE0] rounded">
                          <p className="text-xs font-bold">{baseCV.personal_info.name}</p>
                          <p className="text-[11px] text-gray-500">{baseCV.personal_info.title}</p>
                        </div>
                        <Button variant="ghost" size="xs" mono={false} className="text-blue-600" onClick={replaceBaseCV}>
                          Remplacer le CV importé
                        </Button>
                      </div>
                    )}
                  </div>
                </section>

                {/* Parcours en 3 étapes (remplace l'ancien faux terminal SYSTEM_LOGS) */}
                <section className="stitch-panel">
                  <div className="stitch-panel-header">Comment ça marche</div>
                  <div className="p-4 space-y-3">
                    {[
                      { n: 1, label: 'Importez votre CV (PDF ou LinkedIn)', done: !!baseCV },
                      { n: 2, label: 'Collez l\'offre d\'emploi visée', done: jobDescription.length >= 50 },
                      { n: 3, label: 'Lancez l\'optimisation, puis peaufinez dans l\'éditeur', done: false },
                    ].map(step => (
                      <div key={step.n} className="flex items-center gap-3">
                        <span className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                          step.done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        )}>
                          {step.done ? '✓' : step.n}
                        </span>
                        <span className={cn("text-[12px]", step.done ? "text-gray-800" : "text-gray-600")}>{step.label}</span>
                      </div>
                    ))}
                    <p className="text-[11px] text-gray-500 pt-1">
                      Votre CV sera adapté à l'offre pour passer les ATS, les logiciels qui trient les candidatures avant qu'un recruteur ne les lise.
                    </p>
                    {!user && !accessCode && (
                      <p className="text-[11px] text-gray-600">
                        Bêta privée : un code d'accès vous sera demandé pour les fonctions IA.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              {/* Right: Workspace */}
              <div className="col-span-12 lg:col-span-8 space-y-6">
                <section className="stitch-panel">
                  <div className="stitch-panel-header">2. L'offre d'emploi</div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <form
                          className="flex space-x-2 items-end"
                          onSubmit={(e) => { e.preventDefault(); handleUrlCrawl(); }}
                        >
                          <Input
                            id="job-url"
                            label="Depuis une URL"
                            type="url"
                            inputSize="sm"
                            containerClassName="flex-1"
                            value={jobUrl}
                            onChange={(e) => setJobUrl(e.target.value)}
                            placeholder="https://linkedin.com/jobs/..."
                          />
                          <Button type="submit" variant="secondary" size="sm" loading={isCrawling} disabled={!jobUrl}>
                            Importer
                          </Button>
                        </form>
                        <p className="text-[11px] text-gray-600 italic">Note : Certains sites (LinkedIn, Indeed) bloquent l'accès direct. Copiez-collez le texte si besoin.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] text-gray-600 uppercase block mb-2">Depuis un PDF</label>
                        <div 
                          {...getJobRootProps()} 
                          className={cn(
                            "border border-dashed border-[#DADCE0] rounded p-2 text-center cursor-pointer hover:bg-gray-50 transition-colors h-[34px] flex items-center justify-center",
                            isJobDragActive && "bg-blue-50 border-blue-400"
                          )}
                        >
                          <input {...getJobInputProps()} />
                          {isExtractingJob ? (
                            <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                          ) : (
                            <span className="text-[11px] font-medium text-gray-500">Déposer le PDF de l'offre</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="job-description" className="text-[11px] text-gray-600 uppercase block mb-2">Ou collez le texte de l'offre</label>
                      <textarea
                        id="job-description"
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Collez l'offre d'emploi ici..."
                        className="stitch-input h-48 resize-none stitch-mono text-xs leading-relaxed"
                      />
                    </div>
                    <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-3">
                      <div className="flex flex-col items-end gap-1">
                        <Button
                          mono={false}
                          onClick={handleOptimize}
                          disabled={!baseCV || jobDescription.length < 50 || isGenerating}
                          icon={isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        >
                          {isGenerating ? `Optimisation en cours… ${generatingSeconds}s` : 'Optimiser mon CV pour cette offre'}
                        </Button>
                        {baseCV && !isGenerating && (() => {
                          const size = JSON.stringify(baseCV).length;
                          const estSeconds = size < 3000 ? 30 : size < 6000 ? 60 : size < 10000 ? 120 : size < 15000 ? 180 : 240;
                          return <span className="text-[11px] text-gray-500 stitch-mono">~{estSeconds}s estimé</span>;
                        })()}
                      </div>
                    </div>
                  </div>
                </section>


              </div>

            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Mes CV Sauvegardés</h2>
                  <p className="text-sm text-gray-500">Gérez et éditez vos différentes versions de CV.</p>
                </div>
                <Button mono={false} icon={<Plus className="w-4 h-4" />} onClick={startEmptyCV}>
                  Nouveau CV
                </Button>
              </div>

              {savedCVs.length === 0 ? (
                <div className="stitch-panel p-12 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Aucun CV sauvegardé pour le moment.</p>
                  <p className="text-xs text-gray-600 mt-1">Commencez par optimiser un CV dans la console.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedCVs.map((cv) => (
                    <div key={cv._id} className="stitch-panel group hover:border-blue-400 transition-all">
                      <div className="p-4 border-b border-[#DADCE0] bg-gray-50/50 flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-sm truncate max-w-[180px]">{cv.personal_info.name}</h3>
                          <p className="text-[11px] text-gray-500 truncate max-w-[180px]">{cv.personal_info.title}</p>
                        </div>
                        {/* Hover-only used to hide it from keyboard and touch users entirely */}
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                          <button
                            onClick={() => setCvToDelete(cv._id)}
                            aria-label={`Supprimer le CV ${cv.personal_info.name}`.trim()}
                            title="Supprimer ce CV"
                            className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center text-[11px] text-gray-500 space-x-2">
                          <Calendar className="w-3 h-3" />
                          <span>
                            Sauvegardé le {new Date(cv.createdAt).toLocaleDateString('fr-FR')}
                            {' à '}
                            {new Date(cv.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center text-[11px] text-gray-500 space-x-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="stitch-mono uppercase">Modèle : {templateName(cv.design?.template)}</span>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          fullWidth
                          className="mt-2"
                          icon={<ExternalLink className="w-3 h-3" />}
                          onClick={async () => {
                            // Strip Convex system fields + table-level metadata before
                            // promoting an archived CV to the working draft, otherwise
                            // the next save will reject the contaminated document.
                            const cleanCv = stripPersistenceArtifacts(cv);
                            // Opening a saved CV overwrites the current working draft
                            // (users.lastGeneratedCV or guest_last_optimized): warn first
                            // if a different draft already exists.
                            // The version brings its own offer, or none: left out, the
                            // editor reopened on the previous draft's offer.
                            const offer = cv.jobDescription ?? '';
                            if (
                              replacesDraft(currentDraft(), currentDraftOffer(), cleanCv, offer) &&
                              !window.confirm('Ouvrir ce CV remplacera votre brouillon en cours. Continuer ?')
                            ) {
                              return;
                            }
                            try {
                              if (user) {
                                await storeUser();
                                await updateLastCV({ cvData: cleanCv, jobDescription: offer });
                              } else if (isGuest && !(
                                writeStoredTexts([['guest_last_optimized', JSON.stringify(cleanCv)], ['guest_last_jd', offer]])
                              )) {
                                setNotification({ message: STORAGE_FAILED_MESSAGE, type: 'error' });
                                return;
                              }
                              navigate('/editor');
                            } catch (error) {
                              console.error('Open CV error:', error);
                              setNotification({ message: getUserErrorMessage(error, "Impossible d'ouvrir ce CV. Réessayez."), type: 'error' });
                            }
                          }}
                        >
                          Ouvrir dans l'éditeur
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#DADCE0] flex items-center justify-around px-2 py-1 safe-area-bottom">
        <button 
          onClick={() => setActiveView('console')}
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors min-w-0",
            activeView === 'console' ? "text-blue-600" : "text-gray-500"
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Optimiser</span>
        </button>
        <button 
          onClick={() => setActiveView('cvs')}
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors min-w-0",
            activeView === 'cvs' ? "text-blue-600" : "text-gray-500"
          )}
        >
          <FileText className="w-5 h-5" />
          <span>CV</span>
        </button>
        {/* The sidebar, and its sign-out, are hidden on phones */}
        <button
          onClick={() => void leaveSession()}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors min-w-0 text-gray-500"
        >
          <LogOut className="w-5 h-5" />
          <span>{user ? 'Déconnexion' : 'Quitter'}</span>
        </button>
      </nav>

      {notification && (
        <Notification message={notification.message} type={notification.type} onClose={clearNotification} />
      )}

      <Dialog
        open={cvToDelete !== null}
        onClose={() => setCvToDelete(null)}
        title="Supprimer ce CV ?"
        icon={<Trash2 className="w-5 h-5 text-red-600" />}
      >
        <p className="text-sm text-gray-600 mb-6">Cette action est définitive : la version enregistrée sera perdue.</p>
        <div className="flex gap-3">
          <Button variant="secondary" mono={false} className="flex-1" onClick={() => setCvToDelete(null)}>Annuler</Button>
          <Button variant="danger" mono={false} className="flex-1" onClick={deleteSavedCV}>Supprimer</Button>
        </div>
      </Dialog>
    </div>
  );
}
