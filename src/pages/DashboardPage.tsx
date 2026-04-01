import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Plus, Search, ArrowRight, CheckCircle2, Loader2, User, LayoutDashboard, Calendar, Trash2, ExternalLink, AlertCircle, X } from 'lucide-react';
import { cn } from '../shared/lib/cn';
import { useUser } from '@clerk/clerk-react';
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CVData } from '../shared/types';

interface ATSResult {
  score: number;
  missingKeywords: string[];
  strengths: string[];
  improvements: string[];
  ats_compatibility: 'LOW' | 'MEDIUM' | 'HIGH';
}

export default function DashboardPage() {
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeView, setActiveView] = useState<'console' | 'cvs' | 'ats'>('console');
  const [savedCVs, setSavedCVs] = useState<any[]>([]);
  const [atsResult, setAtsResult] = useState<ATSResult | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [cvToDelete, setCvToDelete] = useState<string | null>(null);

  const convexUser = useQuery(api.users.getMe, user ? undefined : "skip");
  const convexCVs = useQuery(api.cvs.listMyCVs, user ? undefined : "skip");
  
  const storeUser = useMutation(api.users.store);
  const createCV = useMutation(api.cvs.createMyCV);
  const removeCV = useMutation(api.cvs.remove);

  const extractCVDataFromPDF = useAction(api.ai.extractCVDataFromPDF);
  const tailorCV = useAction(api.ai.tailorCV);
  const getATSAnalysis = useAction(api.ai.getATSAnalysis);
  const extractJobDescriptionFromURL = useAction(api.ai.extractJobDescriptionFromURL);
  const extractJobDescriptionFromPDF = useAction(api.ai.extractJobDescriptionFromPDF);

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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    const file = acceptedFiles[0];
    
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const data = await extractCVDataFromPDF({ base64PDF: base64 });
        setBaseCV(data);
        
        if (user) {
          await storeUser();
        } else if (isGuest) {
          localStorage.setItem('guest_base_cv', JSON.stringify(data));
        }
      } catch (error) {
        console.error('Extraction error:', error);
        setNotification({ message: 'Erreur lors de l\'extraction du PDF. Assurez-vous que le fichier est lisible.', type: 'error' });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }, [user, storeUser]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  });

  const onJobDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsExtractingJob(true);
    const file = acceptedFiles[0];
    
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const text = await extractJobDescriptionFromPDF({ base64PDF: base64 });
        setJobDescription(text);
      } catch (error) {
        console.error('Job extraction error:', error);
        setNotification({ message: 'Erreur lors de l\'extraction de la fiche de poste.', type: 'error' });
      } finally {
        setIsExtractingJob(false);
      }
    };
    reader.readAsDataURL(file);
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
      const text = await extractJobDescriptionFromURL({ url: jobUrl });
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
      const optimizedData = await tailorCV({ baseData: baseCV, jobDescription });
      
      if (user) {
        await storeUser();
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

  const handleATSAnalysis = async () => {
    if (!baseCV || !jobDescription) return;
    setIsAnalyzing(true);
    try {
      const result = await getATSAnalysis({ cvData: baseCV, jobDescription });
      setAtsResult(result);
      setActiveView('ats');
    } catch (error) {
      console.error('ATS Analysis error:', error);
      setNotification({ message: 'Erreur lors de l\'analyse ATS.', type: 'error' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="stitch-container">
      {/* Sidebar */}
      <aside className="stitch-sidebar">
        <div className="stitch-header">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-[#1A73E8] rounded flex items-center justify-center">
              <FileText className="text-white w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-tight">CV Builder</span>
          </div>
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
          <button 
            onClick={() => setActiveView('ats')}
            className={cn(
              "w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              activeView === 'ats' ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Search className="w-4 h-4" />
            <span>Analyse ATS</span>
          </button>
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

        <div className="flex-1 overflow-auto p-6">
          {activeView === 'console' ? (
            <div className="grid grid-cols-12 gap-6">
              
              {/* Left: Configuration */}
              <div className="col-span-12 lg:col-span-4 space-y-6">
                <section className="stitch-panel">
                  <div className="stitch-panel-header">01. SOURCE_DATA</div>
                  <div className="p-4">
                    {!baseCV ? (
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
                            <p className="text-xs font-medium">Upload CV (PDF)</p>
                          </>
                        )}
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
                    <div className="grid grid-cols-2 gap-4">
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
                    <div className="mt-4 flex justify-end space-x-3">
                      <button
                        onClick={handleATSAnalysis}
                        disabled={!baseCV || jobDescription.length < 50 || isAnalyzing}
                        className="stitch-button-secondary flex items-center space-x-2 disabled:opacity-50"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        <span>ANALYSE_ATS</span>
                      </button>
                      <button
                        onClick={handleOptimize}
                        disabled={!baseCV || jobDescription.length < 50 || isGenerating}
                        className="stitch-button-primary flex items-center space-x-2 disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4" />
                        )}
                        <span>RUN_OPTIMIZATION</span>
                      </button>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'MATCH_SCORE', value: atsResult ? `${atsResult.score}%` : (baseCV && jobDescription.length > 100 ? '...' : '0%'), color: atsResult ? 'text-green-600' : 'text-gray-400' },
                    { label: 'KEYWORDS_FOUND', value: atsResult ? atsResult.missingKeywords.length : '0', color: 'text-blue-600' },
                    { label: 'ATS_COMPLIANCE', value: atsResult ? atsResult.ats_compatibility : 'PENDING', color: atsResult?.ats_compatibility === 'HIGH' ? 'text-green-600' : 'text-orange-500' },
                  ].map((stat, i) => (
                    <div key={i} className="stitch-panel p-3">
                      <p className="text-[9px] stitch-mono text-gray-500 mb-1">{stat.label}</p>
                      <p className={cn("text-lg font-bold stitch-mono", stat.color)}>{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : activeView === 'ats' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Rapport d'Analyse ATS</h2>
                  <p className="text-sm text-gray-500">Optimisez votre CV pour passer les filtres des recruteurs.</p>
                </div>
                <button 
                  onClick={() => setActiveView('console')}
                  className="stitch-button-secondary"
                >
                  RETOUR_CONSOLE
                </button>
              </div>

              {!atsResult ? (
                <div className="stitch-panel p-12 text-center">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Aucune analyse en cours.</p>
                  <p className="text-xs text-gray-400 mt-1">Lancez une analyse depuis la console avec un CV et une offre.</p>
                </div>
              ) : (
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 lg:col-span-4 space-y-6">
                    <div className="stitch-panel p-6 text-center">
                      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-blue-100 mb-4">
                        <span className="text-3xl font-bold text-blue-600">{atsResult.score}%</span>
                      </div>
                      <h3 className="font-bold text-lg">Score de Match</h3>
                      <p className="text-xs text-gray-500 mt-2">Compatibilité globale avec le poste</p>
                      <div className={cn(
                        "mt-4 px-3 py-1 rounded-full text-[10px] font-bold stitch-mono inline-block",
                        atsResult.ats_compatibility === 'HIGH' ? "bg-green-100 text-green-700" : 
                        atsResult.ats_compatibility === 'MEDIUM' ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                      )}>
                        ATS_LEVEL: {atsResult.ats_compatibility}
                      </div>
                    </div>

                    <div className="stitch-panel">
                      <div className="stitch-panel-header">MOTS_CLÉS_MANQUANTS</div>
                      <div className="p-4 flex flex-wrap gap-2">
                        {atsResult.missingKeywords.map((word, i) => (
                          <span key={i} className="px-2 py-1 bg-red-50 text-red-600 border border-red-100 rounded text-[10px] stitch-mono">
                            {word}
                          </span>
                        ))}
                        {atsResult.missingKeywords.length === 0 && (
                          <p className="text-xs text-gray-500 italic">Aucun mot-clé critique manquant !</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-12 lg:col-span-8 space-y-6">
                    <div className="stitch-panel">
                      <div className="stitch-panel-header">POINTS_FORTS</div>
                      <div className="p-4 space-y-3">
                        {atsResult.strengths.map((strength, i) => (
                          <div key={i} className="flex items-start space-x-3">
                            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                            <p className="text-sm text-gray-700">{strength}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="stitch-panel">
                      <div className="stitch-panel-header">CONSEILS_D_AMÉLIORATION</div>
                      <div className="p-4 space-y-3">
                        {atsResult.improvements.map((improvement, i) => (
                          <div key={i} className="flex items-start space-x-3">
                            <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold mt-0.5">
                              {i + 1}
                            </div>
                            <p className="text-sm text-gray-700">{improvement}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button 
                        onClick={handleOptimize}
                        className="stitch-button-primary flex items-center space-x-2"
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>OPTIMISER_MON_CV_MAINTENANT</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Mes CV Sauvegardés</h2>
                  <p className="text-sm text-gray-500">Gérez et éditez vos différentes versions de CV.</p>
                </div>
                <button 
                  onClick={() => navigate('/editor')}
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
                          <span className="stitch-mono uppercase">Template: {cv.design?.template || 'Classic'}</span>
                        </div>
                        <button 
                          onClick={async () => {
                            if (user) {
                              await storeUser();
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
