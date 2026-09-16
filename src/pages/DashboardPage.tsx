import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { cn } from '../shared/lib/cn';
import { getErrorCode, getUserErrorMessage } from '../shared/lib/convexError';
import { useUser } from '@clerk/clerk-react';
import { useQuery, useMutation, useAction } from "convex/react";
import { Button } from '../shared/ui/Button';
import { Dialog } from '../shared/ui/Dialog';
import { Notification } from '../shared/ui/Notification';
import { AccessCodeDialog } from '../features/auth/components/AccessCodeDialog';
import { AdminCodesDialog } from '../features/auth/components/AdminCodesDialog';
import { useLeaveSession } from '../features/auth/useLeaveSession';
import { api } from "@/convex/_generated/api";
import { CVData, EMPTY_CV, type ATSReport } from '../shared/types';
import {
  readStoredJSON, readStoredText, STORAGE_FAILED_MESSAGE, writeStoredText, writeStoredTexts,
} from '../shared/lib/storage';
import { replacesDraft, stripPersistenceArtifacts } from '../features/editor/hooks/useCVPersistence';
import { useAccessCode, useAutoNotification, useDocumentTitle, useSecondsCounter } from '../shared/hooks';
import { attachBilingualCache } from '../lib/bilingual';
import { withSuggestedPortfolio } from '../features/editor/lib/portfolioVariants';
import { adoptRequirements, pendingRequirements } from '../features/editor/lib/jobRequirementsCache';
import { useDashboardImports } from '../features/dashboard/useDashboardImports';
import { DashboardSidebar, type DashboardView } from '../features/dashboard/components/DashboardSidebar';
import { DashboardMobileNav } from '../features/dashboard/components/DashboardMobileNav';
import { CvImportPanel } from '../features/dashboard/components/CvImportPanel';
import { JobOfferPanel } from '../features/dashboard/components/JobOfferPanel';
import { SavedCVsView, type SavedCVEntry } from '../features/dashboard/components/SavedCVsView';
import { TailorResultPanel } from '../features/dashboard/components/TailorResultPanel';

export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const navigate = useNavigate();
  const { user } = useUser();
  const isGuest = readStoredText('guest_access', 'session') === 'true';

  const [baseCV, setBaseCV] = useState<CVData | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  /** What the tailoring measured, shown until the offer changes: the editor opens from there */
  const [tailorResult, setTailorResult] = useState<ATSReport | null>(null);
  /** A new offer, typed or imported, leaves the previous result behind */
  const showOffer = (text: string) => { setTailorResult(null); setJobDescription(text); };
  const generatingSeconds = useSecondsCounter(isGenerating);
  const [activeView, setActiveView] = useState<DashboardView>('console');
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

  /** Show an AI failure. A code the server refused is forgotten, so the next action asks for a new one. */
  const reportAIError = (error: unknown, fallback: string) => {
    if (getErrorCode(error)?.startsWith('ACCESS_CODE')) clearCode();
    setNotification({ message: getUserErrorMessage(error, fallback), type: 'error' });
  };

  const convexUser = useQuery(api.users.getMe, user ? undefined : "skip");
  const convexCVs = useQuery(api.cvs.listMyCVs, user ? undefined : "skip");

  const storeUser = useMutation(api.users.store);
  const removeCV = useMutation(api.cvs.remove);
  const updateLastCV = useMutation(api.users.updateLastGeneratedCV);
  const saveBaseCV = useMutation(api.users.saveBaseCV);
  const tailorCV = useAction(api.ai.tailorCV);
  const translateCVAction = useAction(api.ai.translateCV);

  const imports = useDashboardImports({
    user, isGuest, jobUrl, getCode, requireAccessCode, reportAIError,
    notify: setNotification, setBaseCV, setJobDescription: showOffer,
  });

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

  const handleOptimize = () => {
    if (!baseCV || !jobDescription) return;
    requireAccessCode(() => { void optimizeForOffer(); });
  };

  const optimizeForOffer = async () => {
    if (!baseCV || !jobDescription) return;
    setIsGenerating(true);

    try {
      // An offer analyzed before is not paid for again
      const requirements = await pendingRequirements(jobDescription, getCode())?.catch(() => undefined);
      const tailoring = tailorCV({ baseData: baseCV, jobDescription, requirements, accessCode: getCode() });
      // The editor opens on this offer: its requirements are already paid for
      adoptRequirements(jobDescription, getCode(), tailoring);
      const result = await tailoring;
      // A CV proposed for an offer comes with the portfolio version that offer calls for
      const optimizedData = withSuggestedPortfolio(result.cv, jobDescription);
      // Eager bilingual: produce the other language now so the editor toggle is
      // instant and never shows a half-translated mix. Degrades gracefully to
      // the original single language if the translation call fails.
      const bilingualData = await attachBilingualCache(optimizedData, translateCVAction, getCode());

      if (user) {
        await storeUser();
        await updateLastCV({ cvData: bilingualData, jobDescription });
      } else if (isGuest) {
        // After paid calls: a full storage must say so, not "réessayez" (and pay again)
        if (!writeStoredTexts([['guest_last_optimized', JSON.stringify(bilingualData)], ['guest_last_jd', jobDescription]])) {
          setNotification({ message: STORAGE_FAILED_MESSAGE, type: 'error' });
          return;
        }
      }
      // The score and its gaps are read here, where the offer is: the editor
      // opens from the panel, not before the result has been seen
      setTailorResult(result.report);
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

  /** Make a CV the working draft, with its offer, then open the editor. `confirm` names what replaces the draft. */
  const openAsDraft = async (cvData: CVData, offer: string, confirm: string, failure: string) => {
    if (replacesDraft(currentDraft(), currentDraftOffer(), cvData, offer) && !window.confirm(confirm)) return;
    try {
      if (user) {
        await storeUser();
        // Awaited BEFORE navigating: the editor reads the draft once, on mount,
        // and used to open on the previous one.
        await updateLastCV({ cvData, jobDescription: offer });
      } else if (isGuest && !writeStoredTexts([['guest_last_optimized', JSON.stringify(cvData)], ['guest_last_jd', offer]])) {
        setNotification({ message: STORAGE_FAILED_MESSAGE, type: 'error' });
        return;
      }
      navigate('/editor');
    } catch (error) {
      // The failure text names the path (blank CV, saved CV): one log label for both
      console.error(`Open draft error (${failure}):`, error);
      setNotification({ message: getUserErrorMessage(error, failure), type: 'error' });
    }
  };

  /** Start from a blank CV. It replaces the working draft, so ask first when there may be one. The old offer goes too. */
  const startEmptyCV = () => openAsDraft(
    EMPTY_CV, '', 'Créer un CV vide remplacera votre brouillon en cours. Continuer ?', 'Impossible de créer le CV vide. Réessayez.',
  );

  /**
   * Promote a saved version to the working draft. Convex system fields and
   * table metadata are stripped, or the next save rejects the document. The
   * version brings its own offer, or none: left out, the editor reopened on
   * the previous draft's offer.
   */
  const openSavedCV = (cv: SavedCVEntry) => openAsDraft(
    stripPersistenceArtifacts(cv as unknown as CVData), cv.jobDescription ?? '',
    'Ouvrir ce CV remplacera votre brouillon en cours. Continuer ?', "Impossible d'ouvrir ce CV. Réessayez.",
  );

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

  // Memoized: the generation counter re-renders the page every second
  const estimateSeconds = useMemo(() => {
    const baseSize = baseCV ? JSON.stringify(baseCV).length : 0;
    return baseSize < 3000 ? 30 : baseSize < 6000 ? 60 : baseSize < 10000 ? 120 : baseSize < 15000 ? 180 : 240;
  }, [baseCV]);

  return (
    <div className="stitch-container">
      <AccessCodeDialog open={showAccessCodePrompt} onClose={closeAccessPrompt} onGranted={onAccessGranted} />
      {isAdmin && <AdminCodesDialog open={showAdminPanel} onClose={() => setShowAdminPanel(false)} />}
      <DashboardSidebar
        activeView={activeView}
        onViewChange={setActiveView}
        isAdmin={isAdmin}
        onOpenAdmin={() => setShowAdminPanel(true)}
        isSignedIn={Boolean(user)}
        isGuest={isGuest}
        fullName={user?.fullName}
        email={user?.primaryEmailAddress?.emailAddress}
        onLeave={() => void leaveSession()}
      />

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
              <div className="col-span-12 lg:col-span-4 space-y-6">
                <CvImportPanel
                  baseCV={baseCV}
                  isUploading={imports.isUploading}
                  dropzone={imports.cvDropzone}
                  onStartEmpty={() => void startEmptyCV()}
                  onReplace={() => void replaceBaseCV()}
                  offerLength={jobDescription.length}
                  showAccessHint={!user && !accessCode}
                />
              </div>
              <div className="col-span-12 lg:col-span-8 space-y-6">
                {tailorResult && (
                  <TailorResultPanel report={tailorResult} onOpenEditor={() => navigate('/editor')} />
                )}
                <JobOfferPanel
                  jobUrl={jobUrl}
                  onJobUrlChange={setJobUrl}
                  onUrlCrawl={imports.handleUrlCrawl}
                  isCrawling={imports.isCrawling}
                  jobDropzone={imports.jobDropzone}
                  isExtractingJob={imports.isExtractingJob}
                  jobDescription={jobDescription}
                  onJobDescriptionChange={showOffer}
                  hasBaseCV={Boolean(baseCV)}
                  onOptimize={handleOptimize}
                  isGenerating={isGenerating}
                  generatingSeconds={generatingSeconds}
                  estimateSeconds={estimateSeconds}
                />
              </div>
            </div>
          ) : (
            <SavedCVsView
              savedCVs={savedCVs}
              onNewCV={() => void startEmptyCV()}
              onOpen={(cv) => void openSavedCV(cv)}
              onRequestDelete={setCvToDelete}
            />
          )}
        </div>
      </main>

      <DashboardMobileNav
        activeView={activeView}
        onViewChange={setActiveView}
        isSignedIn={Boolean(user)}
        onLeave={() => void leaveSession()}
      />

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
