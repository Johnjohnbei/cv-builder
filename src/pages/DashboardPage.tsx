import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Plus, CheckCircle2, Loader2, User, LayoutDashboard, Calendar, Trash2, ExternalLink, AlertCircle, X, Sparkles, Settings } from 'lucide-react';
import { cn } from '../shared/lib/cn';
import { Logo } from '../shared/ui/Logo';
import { useUser } from '@clerk/clerk-react';
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CVData } from '../shared/types';
import { extractTextFromPDF } from '../lib/pdfTextExtract';
import { parseLinkedInPDF } from '../lib/linkedinParser';
import { useAccessCode, useDocumentTitle } from '../shared/hooks';



export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const navigate = useNavigate();
  const { user, isLoaded: isClerkLoaded } = useUser();
  const isGuest = sessionStorage.getItem('guest_access') === 'true';
  
  const [isUploading, setIsUploading] = useState(false);
  const [baseCV, setBaseCV] = useState<CVData | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [isExtractingJob, setIsExtractingJob] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingSeconds, setGeneratingSeconds] = useState(0);
  const [activeView, setActiveView] = useState<'console' | 'cvs'>('console');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [newCodeDays, setNewCodeDays] = useState(30);
  const [newCodeUses, setNewCodeUses] = useState(50);
  const [newCodeLabel, setNewCodeLabel] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const isAdmin = user?.primaryEmailAddress?.emailAddress === 'joaudran@gmail.com';
  const [savedCVs, setSavedCVs] = useState<any[]>([]);

  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [cvToDelete, setCvToDelete] = useState<string | null>(null);
  const { accessCode, saveCode: setAccessCode, getCode } = useAccessCode();
  const [accessEmail, setAccessEmail] = useState('');
  const [showAccessCodePrompt, setShowAccessCodePrompt] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requireAccessCode = (action: () => void) => {
    // Admin bypasses access code
    if (isAdmin) { action(); return; }
    const code = getCode();
    if (code) {
      action();
    } else {
      setPendingAction(() => action);
      setAccessError('');
      setRequestSent(false);
      setShowAccessCodePrompt(true);
    }
  };

  const confirmAccessCode = async () => {
    if (!accessCode) return;
    // The verifyCode query runs reactively — check its result
    // For immediate check, we trust the input and save; if the code is invalid, 
    // the next page load will show the error via the reactive query
    setAccessCode(accessCode);
    setShowAccessCodePrompt(false);
    setAccessError('');
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleRequestAccess = async () => {
    if (!accessEmail) return;
    try {
      await requestAccessMutation({ email: accessEmail, message: 'Demande depuis Calibre' });
      setRequestSent(true);
    } catch {
      setAccessError("Erreur lors de l'envoi. Réessayez.");
    }
  };

  const convexUser = useQuery(api.users.getMe, user ? undefined : "skip");
  const convexCVs = useQuery(api.cvs.listMyCVs, user ? undefined : "skip");
  
  const storeUser = useMutation(api.users.store);
  const createCV = useMutation(api.cvs.createMyCV);
  const removeCV = useMutation(api.cvs.remove);
  const updateLastCV = useMutation(api.users.updateLastGeneratedCV);

  const extractCVDataFromPDF = useAction(api.ai.extractCVDataFromPDF);
  const tailorCV = useAction(api.ai.tailorCV);
  const extractJobDescriptionFromURL = useAction(api.ai.extractJobDescriptionFromURL);
  const extractJobDescriptionFromPDF = useAction(api.ai.extractJobDescriptionFromPDF);
  const verifyCode = useQuery(api.accessCodes.verify, accessCode ? { code: accessCode } : "skip");
  const requestAccessMutation = useMutation(api.accessCodes.requestAccess);
  const generateCodeMutation = useMutation(api.accessCodes.generate);
  const adminCodes = useQuery(api.accessCodes.list, isAdmin ? undefined : "skip");
  const adminRequests = useQuery(api.accessCodes.listRequests, isAdmin ? undefined : "skip");

  useEffect(() => {
    if (user && convexUser?.baseCV) {
      setBaseCV(convexUser.baseCV);
    } else if (isGuest) {
      const stored = localStorage.getItem('guest_base_cv');
      if (stored) setBaseCV(JSON.parse(stored));
    }
  }, [convexUser, user, isGuest]);

  useEffect(() => {
    if (user && convexCVs) {
      setSavedCVs(convexCVs);
    } else if (isGuest) {
      const stored = localStorage.getItem('guest_cvs');
      if (stored) setSavedCVs(JSON.parse(stored));
    }
  }, [convexCVs, user, isGuest]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Live counter while generating
  useEffect(() => {
    if (!isGenerating) { setGeneratingSeconds(0); return; }
    const interval = setInterval(() => setGeneratingSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const doExtract = async () => {
      setIsUploading(true);
      try {
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
          data = await extractCVDataFromPDF({ pdfText: pdfText.substring(0, 12000), accessCode: code });
        }
        setBaseCV(data);

        if (user) {
          await storeUser();
          await updateLastCV({ cvData: data });
        } else if (isGuest) {
          localStorage.setItem('guest_base_cv', JSON.stringify(data));
        }
      } catch (error: any) {
        console.error('Extraction error:', error);
        const msg = error?.message === 'PDF_NO_TEXT'
          ? 'Ce PDF semble être une image scannée. Veuillez utiliser un PDF généré depuis Word, Google Docs ou LinkedIn.'
          : 'Erreur lors de l\'extraction du PDF. Assurez-vous que le fichier est lisible.';
        setNotification({ message: msg, type: 'error' });
      } finally {
        setIsUploading(false);
      }
    };
    requireAccessCode(doExtract);
  }, [user, storeUser, accessCode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  });

  const onJobDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsExtractingJob(true);
    const file = acceptedFiles[0];
    try {
      const pdfText = await extractTextFromPDF(file);
      const text = await extractJobDescriptionFromPDF({ pdfText, accessCode: getCode() });
      setJobDescription(text);
    } catch (error: any) {
      console.error('Job extraction error:', error);
      const msg = error?.message === 'PDF_NO_TEXT'
        ? 'Ce PDF semble être une image scannée. Veuillez copier-coller le texte manuellement.'
        : 'Erreur lors de l\'extraction de la fiche de poste.';
      setNotification({ message: msg, type: 'error' });
    } finally {
      setIsExtractingJob(false);
    }
  }, []);

  const { getRootProps: getJobRootProps, getInputProps: getJobInputProps, isDragActive: isJobDragActive } = useDropzone({ 
    onDrop: onJobDrop,
    accept: { 'application/pdf': ['.pdf', '.txt'] },
    maxFiles: 1
  });

  const handleUrlCrawl = async () => {
    if (!jobUrl) return;
    setIsCrawling(true);
    try {
      const text = await extractJobDescriptionFromURL({ url: jobUrl, accessCode: getCode() });
      if (!text || text.length < 50) {
        setNotification({ message: "Nous n'avons pas pu extraire suffisamment de contenu de cette URL. Notez que les sites comme LinkedIn bloquent souvent l'accès direct. Veuillez copier-coller le texte de l'offre manuellement dans la zone 'Option C'.", type: 'error' });
      } else {
        setJobDescription(text);
      }
    } catch (error) {
      console.error('Crawl error:', error);
      setNotification({ message: 'Erreur lors de la récupération de l\'offre via URL. Les sites protégés (comme LinkedIn) peuvent bloquer cette fonctionnalité.', type: 'error' });
    } finally {
      setIsCrawling(false);
    }
  };

  const handleOptimize = async () => {
    if (!baseCV || !jobDescription) return;
    setIsGenerating(true);
    
    try {
      const optimizedData = await tailorCV({ baseData: baseCV, jobDescription, accessCode: getCode() });
      
      if (user) {
        await storeUser();
        await updateLastCV({ cvData: optimizedData, jobDescription });
        navigate('/editor');
      } else if (isGuest) {
        localStorage.setItem('guest_last_optimized', JSON.stringify(optimizedData));
        navigate('/editor');
      }
    } catch (error) {
      console.error('Optimization error:', error);
      setNotification({ message: 'Erreur lors de l\'optimisation du CV. Veuillez réessayer.', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };


  return (
    <div className="stitch-container">
      {/* Access Code Modal */}
      {showAccessCodePrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Accès aux fonctionnalités IA</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Calibre est un outil fonctionnel qui utilise l'IA pour optimiser votre CV. Les coûts d'infrastructure étant significatifs, un code d'accès est nécessaire pour utiliser les fonctionnalités de génération.
              </p>
            </div>
            
            <input
              type="text"
              value={accessCode}
              onChange={(e) => { setAccessCode(e.target.value); setAccessError(''); }}
              placeholder="Entrez votre code d'accès..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              onKeyDown={(e) => e.key === 'Enter' && accessCode && confirmAccessCode()}
              autoFocus
            />
            {accessError && <p className="text-xs text-red-500 mb-2">{accessError}</p>}
            
            <div className="flex gap-3 mb-6">
              <button 
                onClick={() => { setShowAccessCodePrompt(false); setPendingAction(null); }} 
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={confirmAccessCode} 
                disabled={!accessCode}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40"
              >
                Valider
              </button>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <p className="text-xs text-gray-400 text-center mb-3">
                Pas de code ? Laissez votre email pour être notifié quand le service sera ouvert — ou pour recevoir un accès anticipé.
              </p>
              {requestSent ? (
                <div className="text-center py-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700 font-medium">✓ Demande envoyée !</p>
                  <p className="text-xs text-green-600 mt-1">Vous recevrez un code par email.</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={accessEmail}
                    onChange={(e) => setAccessEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    onKeyDown={(e) => e.key === 'Enter' && accessEmail && handleRequestAccess()}
                  />
                  <button
                    onClick={handleRequestAccess}
                    disabled={!accessEmail}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-40"
                  >
                    Envoyer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Admin Panel Modal */}
      {showAdminPanel && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Admin — Codes d'accès</h3>
              <button onClick={() => setShowAdminPanel(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            
            {/* Generate code */}
            <div className="border rounded-lg p-4 mb-4 space-y-3">
              <h4 className="text-sm font-bold text-gray-700">Générer un code</h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 block">Durée (jours)</label>
                  <input type="number" value={newCodeDays} onChange={e => setNewCodeDays(+e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block">Max utilisations</label>
                  <input type="number" value={newCodeUses} onChange={e => setNewCodeUses(+e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block">Label</label>
                  <input type="text" value={newCodeLabel} onChange={e => setNewCodeLabel(e.target.value)} placeholder="beta" className="w-full border rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <button 
                onClick={async () => {
                  const result = await generateCodeMutation({ maxUses: newCodeUses, durationDays: newCodeDays, label: newCodeLabel || undefined });
                  setGeneratedCode(result.code);
                }}
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Générer
              </button>
              {generatedCode && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-600 mb-1">Code généré :</p>
                  <p className="text-lg font-bold font-mono text-green-800 select-all">{generatedCode}</p>
                </div>
              )}
            </div>

            {/* Active codes */}
            <div className="border rounded-lg p-4 mb-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2">Codes actifs ({adminCodes?.length || 0})</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {adminCodes?.map((c: any) => (
                  <div key={c._id} className="flex justify-between items-center text-xs bg-gray-50 rounded px-3 py-2">
                    <span className="font-mono font-bold">{c.code}</span>
                    <span className="text-gray-500">{c.usedCount}/{c.maxUses} — {c.label || 'sans label'}</span>
                    <span className={new Date(c.expiresAt) < new Date() ? 'text-red-500' : 'text-green-600'}>
                      {new Date(c.expiresAt) < new Date() ? 'Expiré' : `→ ${new Date(c.expiresAt).toLocaleDateString()}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Access requests */}
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2">Demandes d'accès ({adminRequests?.length || 0})</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {adminRequests?.map((r: any) => (
                  <div key={r._id} className="flex justify-between items-center text-xs bg-gray-50 rounded px-3 py-2">
                    <span className="font-medium">{r.email}</span>
                    <span className="text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
                {(!adminRequests || adminRequests.length === 0) && <p className="text-xs text-gray-400">Aucune demande</p>}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Sidebar */}
      <aside className="stitch-sidebar dashboard-sidebar flex-col">
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
            <span>Console</span>
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

          <a
            href="/cover-letter"
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100"
          >
            <FileText className="w-4 h-4" />
            <span>Lettre de motivation</span>
          </a>
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

        <div className="p-4 border-t border-[#DADCE0]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-gray-600" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">{user?.fullName || (isGuest ? 'Invité' : 'Utilisateur')}</p>
              <p className="text-[10px] text-gray-500 truncate">{user?.primaryEmailAddress?.emailAddress || (isGuest ? 'Mode local' : '')}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        <header className="stitch-header justify-between">
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>Projets</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900 font-medium">CV_OPTIMIZER_V2</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] stitch-mono text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
              STATUS: CONNECTED
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 pb-20 md:pb-6">
          {activeView === 'console' ? (
            <div className="grid grid-cols-12 gap-4 lg:gap-6">
              
              {/* Left: Configuration */}
              <div className="col-span-12 lg:col-span-4 space-y-6">
                <section className="stitch-panel">
                  <div className="stitch-panel-header">01. SOURCE_DATA</div>
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
                              <Upload className="w-6 h-6 mx-auto text-gray-400 mb-2" />
                              <p className="text-xs font-medium">Importer un CV (PDF)</p>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            const emptyCV: CVData = {
                              personal_info: { name: '', email: '', title: '' },
                              experience: [],
                              education: [],
                              skills: [],
                              languages: [],
                            };
                            setBaseCV(emptyCV);
                            if (user) {
                              storeUser().then(() => updateLastCV({ cvData: emptyCV }));
                            } else if (isGuest) {
                              localStorage.setItem('guest_last_optimized', JSON.stringify(emptyCV));
                            }
                            navigate('/editor');
                          }}
                          className="w-full py-2 border border-dashed border-blue-300 text-blue-600 text-[10px] font-mono font-bold uppercase tracking-wider hover:bg-blue-50 transition-colors rounded flex items-center justify-center gap-2"
                        >
                          <Plus className="w-3 h-3" />
                          Créer un CV vide
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-gray-50 border border-[#DADCE0] rounded">
                          <p className="text-xs font-bold">{baseCV.personal_info.name}</p>
                          <p className="text-[10px] text-gray-500">{baseCV.personal_info.title}</p>
                        </div>
                        <button 
                          onClick={() => setBaseCV(null)}
                          className="text-[10px] text-blue-600 hover:underline stitch-mono"
                        >
                          REPLACE_SOURCE_FILE
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                <section className="stitch-panel">
                  <div className="stitch-panel-header">02. SYSTEM_LOGS</div>
                  <div className="p-4 bg-black text-green-400 stitch-mono text-[10px] h-48 overflow-auto rounded-b">
                    <p>[{new Date().toLocaleTimeString()}] INITIALIZING_STITCH_ENGINE...</p>
                    <p>[{new Date().toLocaleTimeString()}] AUTH_VERIFIED: {user?.id?.slice(0,8)}</p>
                    {baseCV && <p className="text-blue-400">[{new Date().toLocaleTimeString()}] DATA_EXTRACTED: SUCCESS</p>}
                    {isCrawling && <p className="text-yellow-400 animate-pulse">[{new Date().toLocaleTimeString()}] CRAWLING_JOB_URL...</p>}
                    {isExtractingJob && <p className="text-yellow-400 animate-pulse">[{new Date().toLocaleTimeString()}] EXTRACTING_JOB_FILE...</p>}
                    {isGenerating && <p className="text-yellow-400 animate-pulse">[{new Date().toLocaleTimeString()}] GENERATING_OPTIMIZED_CV...</p>}
                    <p className="opacity-40">_</p>
                  </div>
                </section>
              </div>

              {/* Right: Workspace */}
              <div className="col-span-12 lg:col-span-8 space-y-6">
                <section className="stitch-panel">
                  <div className="stitch-panel-header">03. JOB_SPECIFICATION</div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] stitch-mono text-gray-500 uppercase block mb-2">Option A: URL_SOURCE</label>
                        <div className="flex space-x-2">
                          <input 
                            type="text"
                            value={jobUrl}
                            onChange={(e) => setJobUrl(e.target.value)}
                            placeholder="https://linkedin.com/jobs/..."
                            className="stitch-input flex-1 stitch-mono text-[10px]"
                          />
                          <button 
                            onClick={handleUrlCrawl}
                            disabled={isCrawling || !jobUrl}
                            className="stitch-button-secondary px-3 py-1 text-[10px] disabled:opacity-50"
                          >
                            {isCrawling ? <Loader2 className="w-3 h-3 animate-spin" /> : 'FETCH'}
                          </button>
                        </div>
                        <p className="text-[9px] text-gray-400 italic">Note : Certains sites (LinkedIn, Indeed) bloquent l'accès direct. Copiez-collez le texte si besoin.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] stitch-mono text-gray-500 uppercase block mb-2">Option B: FILE_UPLOAD</label>
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
                            <span className="text-[10px] font-medium text-gray-500">Upload Job PDF</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] stitch-mono text-gray-500 uppercase block mb-2">Option C: MANUAL_INPUT</label>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Collez l'offre d'emploi ici..."
                        className="stitch-input h-48 resize-none stitch-mono text-xs leading-relaxed"
                      />
                    </div>
                    <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-3">
                      <button
                        onClick={handleOptimize}
                        disabled={!baseCV || jobDescription.length < 50 || isGenerating}
                        className="stitch-button-primary flex items-center space-x-2 disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Optimisation en cours… {generatingSeconds}s</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>OPTIMISER MON CV</span>
                          </>
                        )}
                      </button>
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
                <button 
                  onClick={() => {
                    const emptyCV: CVData = {
                      personal_info: { name: '', email: '', title: '' },
                      experience: [],
                      education: [],
                      skills: [],
                      languages: [],
                    };
                    if (user) {
                      storeUser().then(() => updateLastCV({ cvData: emptyCV }));
                    } else if (isGuest) {
                      localStorage.setItem('guest_last_optimized', JSON.stringify(emptyCV));
                    }
                    navigate('/editor');
                  }}
                  className="stitch-button-primary flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>NOUVEAU_CV</span>
                </button>
              </div>

              {savedCVs.length === 0 ? (
                <div className="stitch-panel p-12 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Aucun CV sauvegardé pour le moment.</p>
                  <p className="text-xs text-gray-400 mt-1">Commencez par optimiser un CV dans la console.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedCVs.map((cv) => (
                    <div key={cv._id} className="stitch-panel group hover:border-blue-400 transition-all">
                      <div className="p-4 border-b border-[#DADCE0] bg-gray-50/50 flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-sm truncate max-w-[180px]">{cv.personal_info.name}</h3>
                          <p className="text-[10px] text-gray-500 truncate max-w-[180px]">{cv.personal_info.title}</p>
                        </div>
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setCvToDelete(cv._id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center text-[10px] text-gray-500 space-x-2">
                          <Calendar className="w-3 h-3" />
                          <span>Sauvegardé le {new Date(cv.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center text-[10px] text-gray-500 space-x-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="stitch-mono uppercase">Template: {{ TEMPLATE_A: 'Classic', TEMPLATE_B: 'Modern', TEMPLATE_C: 'Minimal', TEMPLATE_D: 'Creative', TEMPLATE_E: 'Elegant', TEMPLATE_F: 'Sidebar' }[cv.design?.template as string] || cv.design?.template || 'Classic'}</span>
                        </div>
                        <button 
                          onClick={async () => {
                            if (user) {
                              await storeUser();
                              await updateLastCV({ cvData: cv });
                              navigate('/editor');
                            } else if (isGuest) {
                              localStorage.setItem('guest_last_optimized', JSON.stringify(cv));
                              navigate('/editor');
                            }
                          }}
                          className="w-full mt-2 py-2 bg-white border border-[#DADCE0] text-[10px] font-bold stitch-mono hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all flex items-center justify-center space-x-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>OUVRIR_EDITEUR</span>
                        </button>
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
            "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors min-w-0",
            activeView === 'console' ? "text-blue-600" : "text-gray-500"
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Console</span>
        </button>
        <button 
          onClick={() => setActiveView('cvs')}
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors min-w-0",
            activeView === 'cvs' ? "text-blue-600" : "text-gray-500"
          )}
        >
          <FileText className="w-5 h-5" />
          <span>CV</span>
        </button>

        <a
          href="/cover-letter"
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors min-w-0 text-gray-500"
        >
          <FileText className="w-5 h-5" />
          <span>Lettre</span>
        </a>
      </nav>

      {/* Notifications */}
      {notification && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center space-x-3 px-4 py-3 rounded shadow-lg border animate-in slide-in-from-bottom-4 duration-300",
          notification.type === 'success' ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
        )}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="text-xs font-medium">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="p-1 hover:bg-black/5 rounded">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {cvToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white stitch-panel max-w-xs w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="stitch-panel-header">CONFIRM_DELETE</div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-6">Êtes-vous sûr de vouloir supprimer ce CV ? Cette action est irréversible.</p>
              <div className="flex space-x-3">
                <button 
                  onClick={() => setCvToDelete(null)}
                  className="flex-1 py-2 border border-[#DADCE0] text-[10px] font-bold stitch-mono hover:bg-gray-50 transition-colors"
                >
                  ANNULER
                </button>
                <button 
                  onClick={async () => {
                    try {
                      if (user) {
                        await removeCV({ id: cvToDelete as any });
                      } else if (isGuest) {
                        const guestCVs = JSON.parse(localStorage.getItem('guest_cvs') || '[]');
                        const updatedCVs = guestCVs.filter((cv: any) => cv._id !== cvToDelete);
                        localStorage.setItem('guest_cvs', JSON.stringify(updatedCVs));
                        setSavedCVs(updatedCVs);
                      }
                      setNotification({ message: 'CV supprimé avec succès.', type: 'success' });
                    } catch (err) {
                      setNotification({ message: 'Erreur lors de la suppression.', type: 'error' });
                    } finally {
                      setCvToDelete(null);
                    }
                  }}
                  className="flex-1 py-2 bg-red-600 text-white text-[10px] font-bold stitch-mono hover:bg-red-700 transition-colors"
                >
                  SUPPRIMER
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
