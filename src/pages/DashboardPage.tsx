import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { cn } from '../shared/lib/cn';
import { getErrorCode, getUserErrorMessage } from '../shared/lib/convexError';
import { useUser } from '@clerk/clerk-react';
import { useQuery, useMutation } from "convex/react";
import { Button } from '../shared/ui/Button';
import { Dialog } from '../shared/ui/Dialog';
import { Notification } from '../shared/ui/Notification';
import { AccessCodeDialog } from '../features/auth/components/AccessCodeDialog';
import { AdminCodesDialog } from '../features/auth/components/AdminCodesDialog';
import { useLeaveSession } from '../features/auth/useLeaveSession';
import { api } from "@/convex/_generated/api";
import { CVData, EMPTY_CV } from '../shared/types';
import {
  readStoredJSON, readStoredText, STORAGE_FAILED_MESSAGE, writeStoredText, writeStoredTexts,
} from '../shared/lib/storage';
import { replacesDraft, stripPersistenceArtifacts } from '../features/editor/hooks/useCVPersistence';
import { useAccessCode, useAutoNotification, useDocumentTitle, useSecondsCounter } from '../shared/hooks';
import { useDashboardImports } from '../features/dashboard/useDashboardImports';
import { useOfferTailoring } from '../features/dashboard/useOfferTailoring';
import { DashboardSidebar, type DashboardView } from '../features/dashboard/components/DashboardSidebar';
import { DashboardMobileNav } from '../features/dashboard/components/DashboardMobileNav';
import { CvImportPanel } from '../features/dashboard/components/CvImportPanel';
import { JobOfferPanel } from '../features/dashboard/components/JobOfferPanel';
import { SavedCVsView, type SavedCVEntry } from '../features/dashboard/components/SavedCVsView';
import { OfferGapsPanel } from '../features/dashboard/components/OfferGapsPanel';

export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const navigate = useNavigate();
  const { user } = useUser();
  const isGuest = readStoredText('guest_access', 'session') === 'true';

  const [baseCV, setBaseCV] = useState<CVData | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jobUrl, setJobUrl] = useState('');
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

  const tailoring = useOfferTailoring({
    baseCV, offer: jobDescription, getCode, reportAIError,
    // After paid calls, a failed save says so and never offers to pay again
    saveDraft: cvData => saveDraft(cvData, jobDescription, "Le CV a été écrit mais n'a pas pu être enregistré."),
    onTailored: () => navigate('/editor'),
  });
  const isGenerating = tailoring.phase === 'analyzing' || tailoring.phase === 'generating';
  const generatingSeconds = useSecondsCounter(isGenerating);
  const busyLabel = {
    idle: null,
    analyzing: `Lecture de l'offre et du CV… ${generatingSeconds}s`,
    asking: 'Répondez aux écarts ci-dessus',
    generating: `Écriture du CV… ${generatingSeconds}s`,
  }[tailoring.phase];
  /** A new offer, typed or imported, leaves the questions about the previous one behind */
  const showOffer = (text: string) => { tailoring.reset(); setJobDescription(text); };

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
    requireAccessCode(() => { void tailoring.start(); });
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
    // Awaited BEFORE navigating: the editor reads the draft once, on mount
    if (await saveDraft(cvData, offer, failure)) navigate('/editor');
  };

  /** A CV stored as the working draft with its offer: false when it could not be, the user told why */
  const saveDraft = async (cvData: CVData, offer: string, failure: string): Promise<boolean> => {
    try {
      if (user) {
        await storeUser();
        await updateLastCV({ cvData, jobDescription: offer });
      } else if (isGuest && !writeStoredTexts([['guest_last_optimized', JSON.stringify(cvData)], ['guest_last_jd', offer]])) {
        setNotification({ message: STORAGE_FAILED_MESSAGE, type: 'error' });
        return false;
      }
      return true;
    } catch (error) {
      // The failure text names the path (blank CV, saved CV, tailored CV): one log label for all
      console.error(`Save draft error (${failure}):`, error);
      setNotification({ message: getUserErrorMessage(error, failure), type: 'error' });
      return false;
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
                {tailoring.gaps && tailoring.asked && tailoring.phase !== 'idle' && (
                  <OfferGapsPanel
                    requirementCount={tailoring.gaps.requirements.length}
                    provable={tailoring.gaps.provable}
                    factual={tailoring.gaps.factual}
                    proofs={tailoring.proofs}
                    onProofChange={tailoring.setProof}
                    tooShort={tailoring.tooShort}
                    dismissed={tailoring.dismissed}
                    onDismiss={tailoring.dismiss}
                    onRestore={tailoring.restore}
                    onGenerate={tailoring.confirm}
                    onCancel={tailoring.reset}
                    isGenerating={tailoring.phase === 'generating'}
                    generatingSeconds={generatingSeconds}
                  />
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
                  busyLabel={busyLabel}
                  offerLocked={tailoring.phase === 'analyzing' || tailoring.phase === 'generating'}
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
