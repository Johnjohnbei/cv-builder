import React, { useState, useRef, useEffect } from 'react';
import { CVData, DesignSettings } from '../shared/types';
import { Download, Layout as LayoutIcon, Eye, Save, Loader2, FileText, User, Settings, Mail, Phone, MapPin, Linkedin, Plus, Trash2, ChevronDown, ChevronUp, Briefcase, GraduationCap, Award, Languages, AlignLeft, Sparkles, X, Zap, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../shared/lib/cn';
import { Logo } from '../shared/ui/Logo';
import { useUser } from '@clerk/clerk-react';
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { renderPDF } from '../features/editor/lib/pdfExport';
import { CVRenderer } from '../features/editor/templates';
import { TemplateA as TemplateAComponent } from '../features/editor/templates/TemplateA';
import { getVisibleBullets, getVisibleSkills } from '../features/editor/lib/displayModes';
import { DISPLAY_MODES, SKILL_DISPLAY_MODES } from '../features/editor/lib/displayModes';
import { autoAssignModes, extractKeywords, scoreExperience, formatDateShort } from '../features/editor/lib/scoring';
import { condenseOneStep } from '../features/editor/lib/autoFit';

const TEMPLATE_NAMES: Record<string, string> = {
  TEMPLATE_A: 'Classic',
  TEMPLATE_B: 'Modern',
  TEMPLATE_C: 'Minimal',
  TEMPLATE_D: 'Creative',
  TEMPLATE_E: 'Elegant',
  TEMPLATE_F: 'Sidebar',
};

export default function EditorPage() {
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'design'>('content');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('TEMPLATE_A');
  const [designSettings, setDesignSettings] = useState<DesignSettings>({
    template: 'TEMPLATE_A',
    primaryColor: '#1A73E8',
    secondaryColor: '#5F6368',
    fontFamily: 'sans',
    sectionTitleWeight: 'bold',
    sectionTitleTransform: 'uppercase',
    sectionTitleSpacing: 'widest',
    pageLimit: 1,
    showPhoto: true,
    paperSize: 'a4',
    orientation: 'portrait',
    includedSections: ['personal', 'summary', 'experience', 'education', 'skills', 'languages']
  });
  const [expandedSection, setExpandedSection] = useState<string | null>('personal');
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(85);
  const [isAutoZoom, setIsAutoZoom] = useState(true);
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [improvingBullet, setImprovingBullet] = useState<string | null>(null); // "expIdx-bulletIdx"
  const [bulletSuggestions, setBulletSuggestions] = useState<{ key: string; suggestions: string[] } | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [userModified, setUserModified] = useState(false);
  const cvRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const { user } = useUser();
  const isGuest = sessionStorage.getItem('guest_access') === 'true';
  const userData = useQuery(api.users.getMe, user ? undefined : "skip");
  const storeUser = useMutation(api.users.store);
  const createCV = useMutation(api.cvs.createMyCV);
  const optimizeCVAction = useAction(api.ai.optimizeCVForPage);
  const improveBulletAction = useAction(api.ai.improveBulletPoint);

  // ─── Overflow detection + auto-fit loop ───
  const [overflowPx, setOverflowPx] = useState(0);
  const fitIterations = useRef(0);
  const MAX_FIT_ITERATIONS = 50; // safety limit
  
  useEffect(() => {
    const el = cvRef.current;
    if (!el) { setOverflowPx(0); return; }
    
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const overflow = el.scrollHeight - el.clientHeight;
        setOverflowPx(Math.max(0, overflow));
        
        // Auto-fit: condense one step if overflowing and not user-modified
        if (overflow > 2 && !userModified && cvData && fitIterations.current < MAX_FIT_ITERATIONS) {
          const keywords = extractKeywords(jobDescription);
          const priorities = cvData.experience.map(exp => scoreExperience(exp, keywords));
          const result = condenseOneStep(cvData.experience, cvData.skills, priorities);
          if (result) {
            fitIterations.current++;
            setCvData(prev => prev ? { ...prev, experience: result.experiences, skills: result.skills } : null);
          }
          // If condenseOneStep returned null, we can't condense further — stop
        }
      });
    });
    
    return () => cancelAnimationFrame(raf);
  }, [cvData, designSettings, userModified, jobDescription]);

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Load data from Convex or LocalStorage
  useEffect(() => {
    if (user && userData) {
      if (userData.lastGeneratedCV) {
        setCvData(userData.lastGeneratedCV);
        if (userData.lastGeneratedCV.design) {
          setDesignSettings(userData.lastGeneratedCV.design);
          setSelectedTemplate(userData.lastGeneratedCV.design.template);
        }
      }
      setIsLoading(false);
    } else if (isGuest) {
      const stored = localStorage.getItem('guest_last_optimized');
      if (stored) {
        const data = JSON.parse(stored);
        setCvData(data);
        if (data.design) {
          setDesignSettings(data.design);
          setSelectedTemplate(data.design.template);
        }
      }
      setIsLoading(false);
    } else if (userData === null) {
      setIsLoading(false);
    }
  }, [userData, user, isGuest]);

  // Auto-assign display modes when CV is loaded without them
  const hasAutoAssigned = useRef(false);
  useEffect(() => {
    if (!cvData || !cvData.experience?.length || hasAutoAssigned.current) return;
    const hasAnyMode = cvData.experience.some(exp => exp.displayMode);
    if (hasAnyMode) { hasAutoAssigned.current = true; return; }
    
    hasAutoAssigned.current = true;
    fitIterations.current = 0; // allow auto-fit after initial assignment
    const keywords = extractKeywords(jobDescription);
    const autoExperiences = autoAssignModes(cvData.experience, keywords, designSettings.pageLimit || 1);
    setCvData(prev => prev ? { ...prev, experience: autoExperiences } : null);
  }, [cvData?.experience?.length]);

  // Auto-zoom to fit width
  useEffect(() => {
    if (isAutoZoom && cvRef.current && previewContainerRef.current) {
      const containerWidth = previewContainerRef.current.clientWidth;
      const cvWidth = 794; // 210mm in pixels approx
      const padding = 64;
      const newZoom = Math.floor(((containerWidth - padding) / cvWidth) * 100);
      setZoom(Math.min(100, Math.max(30, newZoom)));
    }
  }, [isAutoZoom, cvData, activeTab]);

  // Handle window resize for auto-zoom
  useEffect(() => {
    const handleResize = () => {
      if (isAutoZoom) {
        const containerWidth = previewContainerRef.current?.clientWidth || 0;
        const cvWidth = 794;
        const padding = 64;
        const newZoom = Math.floor(((containerWidth - padding) / cvWidth) * 100);
        setZoom(Math.min(100, Math.max(30, newZoom)));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAutoZoom]);

  const applyTemplateDefaults = (templateId: string) => {
    const defaults: Record<string, Partial<DesignSettings>> = {
      'TEMPLATE_A': { fontFamily: 'sans', sectionTitleWeight: 'bold', sectionTitleSpacing: 'widest', sectionTitleTransform: 'uppercase' },
      'TEMPLATE_B': { fontFamily: 'sans', sectionTitleWeight: 'semibold', sectionTitleSpacing: 'normal', sectionTitleTransform: 'uppercase' },
      'TEMPLATE_C': { fontFamily: 'serif', sectionTitleWeight: 'normal', sectionTitleSpacing: 'normal', sectionTitleTransform: 'uppercase' },
      'TEMPLATE_D': { fontFamily: 'playfair', sectionTitleWeight: 'black', sectionTitleSpacing: 'tight', sectionTitleTransform: 'none' },
      'TEMPLATE_E': { fontFamily: 'outfit', sectionTitleWeight: 'medium', sectionTitleSpacing: 'wide', sectionTitleTransform: 'uppercase' },
      'TEMPLATE_F': { fontFamily: 'sans', sectionTitleWeight: 'bold', sectionTitleSpacing: 'wider', sectionTitleTransform: 'uppercase' },
    };
    
    if (defaults[templateId]) {
      setDesignSettings(prev => ({ ...prev, ...defaults[templateId], template: templateId }));
    }
    setSelectedTemplate(templateId);
  };

  const confirmTemplateChange = () => {
    if (pendingTemplate) {
      applyTemplateDefaults(pendingTemplate);
      setPendingTemplate(null);
      setShowTemplateConfirm(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const renderCV = () => {
    if (!cvData) return null;

    const { 
      primaryColor, 
      secondaryColor, 
      fontFamily, 
      sectionTitleWeight, 
      sectionTitleTransform, 
      sectionTitleSpacing, 
      showPhoto,
      includedSections = ['personal', 'summary', 'experience', 'education', 'skills', 'languages']
    } = designSettings;
    const fontClass = 
      fontFamily === 'serif' ? 'font-serif' : 
      fontFamily === 'mono' ? 'font-mono' : 
      fontFamily === 'playfair' ? 'font-playfair' :
      fontFamily === 'outfit' ? 'font-outfit' :
      'font-sans';

    const sectionTitleClasses = cn(
      sectionTitleWeight === 'normal' && "font-normal",
      sectionTitleWeight === 'medium' && "font-medium",
      sectionTitleWeight === 'semibold' && "font-semibold",
      sectionTitleWeight === 'bold' && "font-bold",
      sectionTitleWeight === 'black' && "font-black",
      sectionTitleTransform === 'none' && "normal-case",
      sectionTitleTransform === 'uppercase' && "uppercase",
      sectionTitleTransform === 'capitalize' && "capitalize",
      sectionTitleSpacing === 'tight' && "tracking-tight",
      sectionTitleSpacing === 'normal' && "tracking-normal",
      sectionTitleSpacing === 'wide' && "tracking-wide",
      sectionTitleSpacing === 'wider' && "tracking-wider",
      sectionTitleSpacing === 'widest' && "tracking-widest"
    );

    const commonStyles = {
      '--primary': primaryColor,
      '--secondary': secondaryColor,
    } as React.CSSProperties;

    const renderPhoto = (className: string = "w-24 h-24 rounded-full object-cover") => {
      if (!showPhoto || !cvData.personal_info?.photo_url) return null;
      return (
        <div className={cn("overflow-hidden shrink-0", className)}>
          <img 
            src={cvData.personal_info.photo_url} 
            alt={cvData.personal_info.name} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    };

    if (selectedTemplate === 'TEMPLATE_A') {
      return <TemplateAComponent cvData={cvData} designSettings={designSettings} />;
    }

    if (selectedTemplate === 'TEMPLATE_B') {
      return (
        <div style={commonStyles} className={cn("w-full h-full bg-white grid grid-cols-[1fr_2fr] pdf-safe", fontClass)}>
          <div className="text-white p-12 flex flex-col justify-between" style={{ backgroundColor: primaryColor }}>
            <div>
              {includedSections.includes('personal') && (
                <>
                  {showPhoto && cvData.personal_info?.photo_url ? (
                    renderPhoto("w-24 h-24 rounded-full mb-8 border-2 border-white/20")
                  ) : (
                    <div className="w-24 h-24 rounded-full mb-8 flex items-center justify-center text-3xl font-bold bg-white/20">
                      {cvData.personal_info?.name?.charAt(0)}
                    </div>
                  )}
                  <h1 className="text-2xl font-bold leading-tight mb-2">{cvData.personal_info?.name}</h1>
                  <p className="font-medium text-sm mb-12 opacity-80">{cvData.personal_info?.title}</p>
                </>
              )}

              {includedSections.includes('summary') && cvData.personal_info?.summary && (
                <section data-cv-section="summary" className="mb-12">
                  <h2 className={cn("opacity-60 mb-4", sectionTitleClasses)} style={{ fontSize: '10px' }}>Profil</h2>
                  <p className="text-[11px] leading-relaxed opacity-90">{cvData.personal_info?.summary}</p>
                </section>
              )}

              <div className="space-y-6">
                {includedSections.includes('personal') && (
                  <section data-cv-section="contact">
                    <h2 className={cn("opacity-60 mb-4", sectionTitleClasses)} style={{ fontSize: '10px' }}>Contact</h2>
                    <div className="space-y-3 text-[11px] opacity-90">
                      <div className="flex items-center gap-3"><Mail className="w-3 h-3" /> {cvData.personal_info?.email}</div>
                      {cvData.personal_info?.phone && <div className="flex items-center gap-3"><Phone className="w-3 h-3" /> {cvData.personal_info?.phone}</div>}
                      {cvData.personal_info?.location && <div className="flex items-center gap-3"><MapPin className="w-3 h-3" /> {cvData.personal_info?.location}</div>}
                    </div>
                  </section>
                )}

                {includedSections.includes('languages') && (cvData.languages?.length || 0) > 0 && (
                  <section data-cv-section="languages">
                    <h2 className={cn("opacity-60 mb-4", sectionTitleClasses)} style={{ fontSize: '10px' }}>Langues</h2>
                    <div className="space-y-2">
                      {cvData.languages?.map((lang, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px]">
                          <span className="opacity-90">{lang.name}</span>
                          <span className="opacity-60 text-[9px] uppercase tracking-wider">{lang.proficiency}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {includedSections.includes('skills') && (
                  <section data-cv-section="skills">
                    <h2 className={cn("opacity-60 mb-4", sectionTitleClasses)} style={{ fontSize: '10px' }}>Expertise</h2>
                    <div className="space-y-4">
                      {cvData.skills?.filter(cat => (cat.displayMode || "normal") !== "hidden").map((cat, idx) => (
                        <div key={idx} className="space-y-2">
                          <h3 className="text-[9px] font-bold uppercase tracking-widest opacity-80">{cat.category}</h3>
                          <div className="flex flex-wrap gap-2">
                            {getVisibleSkills(cat).map(skill => (
                              <span key={skill} className="px-2 py-1 bg-white/10 text-white text-[9px] font-medium rounded">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>

          <div className="p-16 space-y-12">
            {includedSections.includes('experience') && (
              <section data-cv-section="experience">
                <h2 className={cn("text-gray-900 flex items-center gap-3 mb-8", sectionTitleClasses)} style={{ fontSize: '1.125rem' }}>
                  <span className="w-8 h-1 rounded-full" style={{ backgroundColor: secondaryColor }} />
                  Expérience
                </h2>
                <div className="space-y-8">
                  {cvData.experience?.filter(e => (e.displayMode || "normal") !== "hidden").map((exp, idx) => (
                    <div key={idx} data-cv-block="experience" className="relative pl-8 border-l border-gray-100">
                      <div className="absolute -left-[5px] top-2 w-2 h-2 rounded-full" style={{ backgroundColor: secondaryColor }} />
                      <div className="flex justify-between items-baseline gap-4 mb-1">
                        <h3 className="font-bold text-gray-900">{exp.position}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 whitespace-nowrap" style={{ color: secondaryColor, backgroundColor: `${secondaryColor}10` }}>{formatDateShort(exp.start_date)} — {exp.current ? 'Présent' : formatDateShort(exp.end_date)}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-500 mb-3">{exp.company}</p>
                      <ul className="space-y-2">
                        {getVisibleBullets(exp).map((bullet, bIdx) => (
                          <li key={bIdx} className="text-sm text-gray-600 leading-relaxed flex gap-3">
                            <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />
                            {bullet}
                          </li>
                        ))}
                      </ul>

                              {(exp.displayMode || 'normal') === 'extended' && exp.kpi && (
                                <p className="text-xs font-bold mt-2" style={{ color: primaryColor }}>📈 {exp.kpi}</p>
                              )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {includedSections.includes('education') && (
              <section data-cv-section="education">
                <h2 className={cn("text-gray-900 flex items-center gap-3 mb-8", sectionTitleClasses)} style={{ fontSize: '1.125rem' }}>
                  <span className="w-8 h-1 rounded-full" style={{ backgroundColor: secondaryColor }} />
                  Formation
                </h2>
                <div className="space-y-6">
                  {cvData.education?.map((edu, idx) => (
                    <div key={idx} className="space-y-1">
                      <p className="text-sm font-bold text-gray-900">{edu.degree}</p>
                      <p className="text-xs text-gray-500">{edu.school} • {edu.end_date}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      );
    }

    if (selectedTemplate === 'TEMPLATE_C') {
      return (
        <div style={commonStyles} className={cn("w-full h-full bg-white p-16 space-y-12 pdf-safe", fontClass)}>
          {includedSections.includes('personal') && (
            <header className="text-center space-y-4 flex flex-col items-center">
              {renderPhoto("w-24 h-24 rounded-full mb-2 border-2 border-gray-100")}
              <h1 className="text-5xl font-light tracking-tight" style={{ color: primaryColor }}>{cvData.personal_info?.name}</h1>
              <p className="text-sm uppercase tracking-[0.3em] text-gray-500">{cvData.personal_info?.title}</p>
              <div className="flex justify-center gap-6 text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                <span>{cvData.personal_info?.email}</span>
                {cvData.personal_info?.phone && <span>{cvData.personal_info?.phone}</span>}
                {cvData.personal_info?.location && <span>{cvData.personal_info?.location}</span>}
              </div>
            </header>
          )}

          <div className="space-y-12">
            {includedSections.includes('summary') && cvData.personal_info?.summary && (
              <section data-cv-section="summary" className="max-w-2xl mx-auto text-center">
                <h2 className={cn("text-gray-300 mb-4", sectionTitleClasses)} style={{ fontSize: '11px' }}>Profil</h2>
                <p className="text-sm text-gray-600 leading-relaxed italic">"{cvData.personal_info?.summary}"</p>
              </section>
            )}

            {includedSections.includes('experience') && (
              <section data-cv-section="experience">
                <h2 className={cn("text-gray-300 mb-8 text-center", sectionTitleClasses)} style={{ fontSize: '11px' }}>Expérience</h2>
                <div className="space-y-10">
                  {cvData.experience?.filter(e => (e.displayMode || "normal") !== "hidden").map((exp, idx) => (
                    <div key={idx} data-cv-block="experience" className="grid grid-cols-[120px_1fr] gap-8">
                      <div className="text-[10px] font-mono text-gray-400 pt-1">
                        {formatDateShort(exp.start_date)} — {exp.current ? 'PRESENT' : formatDateShort(exp.end_date)}
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-bold text-gray-900 uppercase tracking-tight">{exp.position}</h3>
                        <p className="text-xs font-medium" style={{ color: secondaryColor }}>{exp.company}</p>
                        <ul className="space-y-2 pt-2">
                          {getVisibleBullets(exp).map((bullet, bIdx) => (
                            <li key={bIdx} className="text-sm text-gray-600 leading-relaxed flex gap-3">
                              <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />
                              {bullet}
                            </li>
                          ))}
                        </ul>

                              {(exp.displayMode || 'normal') === 'extended' && exp.kpi && (
                                <p className="text-xs font-bold mt-2" style={{ color: primaryColor }}>📈 {exp.kpi}</p>
                              )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section data-cv-section="skills" className="grid grid-cols-2 gap-16">
              {includedSections.includes('skills') && (
                <div>
                  <h2 className={cn("text-gray-300 mb-6", sectionTitleClasses)} style={{ fontSize: '11px' }}>Compétences</h2>
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    {cvData.skills?.filter(cat => (cat.displayMode || "normal") !== "hidden").map((cat, idx) => (
                      <div key={idx} className="space-y-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{cat.category}</p>
                        <p className="text-xs text-gray-700">{getVisibleSkills(cat).join(', ') || ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {includedSections.includes('education') && (
                <div>
                  <h2 className={cn("text-gray-300 mb-6", sectionTitleClasses)} style={{ fontSize: '11px' }}>Formation</h2>
                  <div className="space-y-4">
                    {cvData.education?.map((edu, idx) => (
                      <div key={idx}>
                        <p className="text-xs font-bold text-gray-900 uppercase">{edu.degree}</p>
                        <p className="text-[10px] text-gray-500">{edu.school} • {edu.end_date}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {includedSections.includes('languages') && (cvData.languages?.length || 0) > 0 && (
              <section data-cv-section="languages">
                <h2 className={cn("text-gray-300 mb-6 text-center", sectionTitleClasses)} style={{ fontSize: '11px' }}>Langues</h2>
                <div className="flex justify-center gap-12">
                  {cvData.languages?.map((lang, idx) => (
                    <div key={idx} className="text-center">
                      <p className="text-xs font-bold text-gray-900 uppercase">{lang.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest">{lang.proficiency}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      );
    }

    if (selectedTemplate === 'TEMPLATE_D') {
      return (
        <div style={commonStyles} className={cn("w-full h-full bg-[#FDFCFB] p-0 pdf-safe", fontClass)}>
          {includedSections.includes('personal') && (
            <div className="p-16 pb-8" style={{ backgroundColor: `${primaryColor}10` }}>
              <div className="flex justify-between items-start">
                <div className="flex gap-8 items-start">
                  {renderPhoto("w-32 h-32 rounded-none border-4 border-black")}
                  <div className="space-y-2">
                    <h1 className="text-6xl font-black italic tracking-tighter" style={{ color: primaryColor }}>{cvData.personal_info?.name?.split(' ')[0]}<br/>{cvData.personal_info?.name?.split(' ')[1]}</h1>
                    <p className="text-xl font-bold uppercase tracking-widest" style={{ color: secondaryColor }}>{cvData.personal_info?.title}</p>
                  </div>
                </div>
                <div className="text-right space-y-1 text-xs font-bold stitch-mono">
                  <p>{cvData.personal_info?.email}</p>
                  {cvData.personal_info?.phone && <p>{cvData.personal_info?.phone}</p>}
                  {cvData.personal_info?.location && <p>{cvData.personal_info?.location}</p>}
                </div>
              </div>
            </div>
          )}

          <div className="p-16 pt-12 grid grid-cols-[2fr_1fr] gap-16">
            <div className="space-y-12">
              {includedSections.includes('summary') && cvData.personal_info?.summary && (
                <section data-cv-section="summary">
                  <div className="flex items-center gap-4 mb-6">
                    <h2 className={cn("italic", sectionTitleClasses)} style={{ color: primaryColor, fontSize: '1.5rem' }}>Profil</h2>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed font-medium">{cvData.personal_info?.summary}</p>
                </section>
              )}

              {includedSections.includes('experience') && (
                <section data-cv-section="experience">
                  <div className="flex items-center gap-4 mb-8">
                    <h2 className={cn("italic", sectionTitleClasses)} style={{ color: primaryColor, fontSize: '1.5rem' }}>Expérience</h2>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <div className="space-y-12">
                    {cvData.experience?.filter(e => (e.displayMode || "normal") !== "hidden").map((exp, idx) => (
                      <div key={idx} data-cv-block="experience" className="space-y-3">
                        <div className="flex justify-between items-baseline">
                          <h3 className="text-lg font-black uppercase tracking-tight">{exp.position}</h3>
                          <span className="text-[10px] font-bold stitch-mono bg-black text-white px-2 py-0.5 shrink-0 whitespace-nowrap">{formatDateShort(exp.start_date)} — {exp.current ? 'NOW' : formatDateShort(exp.end_date)}</span>
                        </div>
                        <p className="text-sm font-bold italic" style={{ color: secondaryColor }}>{exp.company}</p>
                        <ul className="space-y-2">
                          {getVisibleBullets(exp).map((bullet, bIdx) => (
                            <li key={bIdx} className="text-sm text-gray-700 leading-relaxed flex gap-3">
                              <span className="font-bold" style={{ color: primaryColor }}>/</span>
                              {bullet}
                            </li>
                          ))}
                        </ul>

                              {(exp.displayMode || 'normal') === 'extended' && exp.kpi && (
                                <p className="text-xs font-bold mt-2" style={{ color: primaryColor }}>📈 {exp.kpi}</p>
                              )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-12">
              {includedSections.includes('skills') && (
                <section data-cv-section="skills">
                  <h2 className={cn("italic mb-6 underline decoration-4 underline-offset-4", sectionTitleClasses)} style={{ textDecorationColor: secondaryColor, fontSize: '1.125rem' }}>Compétences</h2>
                  <div className="space-y-6">
                    {cvData.skills?.filter(cat => (cat.displayMode || "normal") !== "hidden").map((cat, idx) => (
                      <div key={idx} className="space-y-2">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{cat.category}</h3>
                        <div className="flex flex-wrap gap-2">
                          {getVisibleSkills(cat).map(skill => (
                            <span key={skill} className="px-2 py-1 border-2 border-black text-[10px] font-black uppercase hover:bg-black hover:text-white transition-colors">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {includedSections.includes('education') && (
                <section data-cv-section="education">
                  <h2 className={cn("italic mb-6 underline decoration-4 underline-offset-4", sectionTitleClasses)} style={{ textDecorationColor: secondaryColor, fontSize: '1.125rem' }}>Formation</h2>
                  <div className="space-y-6">
                    {cvData.education?.map((edu, idx) => (
                      <div key={idx} className="space-y-1">
                        <p className="text-sm font-black uppercase">{edu.degree}</p>
                        <p className="text-xs font-bold text-gray-500 italic">{edu.school}</p>
                        <p className="text-[10px] font-bold stitch-mono">{edu.end_date}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {includedSections.includes('languages') && (cvData.languages?.length || 0) > 0 && (
                <section data-cv-section="languages">
                  <h2 className={cn("italic mb-6 underline decoration-4 underline-offset-4", sectionTitleClasses)} style={{ textDecorationColor: secondaryColor, fontSize: '1.125rem' }}>Langues</h2>
                  <div className="space-y-4">
                    {cvData.languages?.map((lang, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-sm font-black uppercase">{lang.name}</span>
                        <span className="text-[10px] font-bold stitch-mono bg-gray-100 px-2 py-0.5">{lang.proficiency}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (selectedTemplate === 'TEMPLATE_E') {
      return (
        <div style={commonStyles} className={cn("w-full h-full bg-white p-16 pdf-safe", fontClass)}>
          {includedSections.includes('personal') && (
            <div className="flex justify-between items-start mb-12">
              <div className="flex gap-8 items-start">
                {renderPhoto("w-24 h-24 rounded-xl border-2 border-gray-100")}
                <div className="space-y-1">
                  <h1 className="text-5xl font-extrabold tracking-tight" style={{ color: primaryColor }}>{cvData.personal_info?.name}</h1>
                  <p className="text-lg font-medium tracking-wide uppercase opacity-70">{cvData.personal_info?.title}</p>
                </div>
              </div>
              <div className="text-right text-xs space-y-1 opacity-60">
                <p>{cvData.personal_info?.email}</p>
                {cvData.personal_info?.phone && <p>{cvData.personal_info?.phone}</p>}
                {cvData.personal_info?.location && <p>{cvData.personal_info?.location}</p>}
              </div>
            </div>
          )}

          <div className="space-y-12">
            {includedSections.includes('summary') && cvData.personal_info?.summary && (
              <section data-cv-section="summary">
                <div className="flex items-center gap-4 mb-6">
                  <h2 className={cn(sectionTitleClasses)} style={{ color: primaryColor, fontSize: '0.75rem' }}>Profil</h2>
                  <div className="flex-1 h-[2px]" style={{ backgroundColor: `${primaryColor}20` }} />
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{cvData.personal_info?.summary}</p>
              </section>
            )}

            {includedSections.includes('experience') && (
              <section data-cv-section="experience">
                <div className="flex items-center gap-4 mb-6">
                  <h2 className={cn(sectionTitleClasses)} style={{ color: primaryColor, fontSize: '0.75rem' }}>Expérience</h2>
                  <div className="flex-1 h-[2px]" style={{ backgroundColor: `${primaryColor}20` }} />
                </div>
                <div className="space-y-8">
                  {cvData.experience?.filter(e => (e.displayMode || "normal") !== "hidden").map((exp, idx) => (
                    <div key={idx} data-cv-block="experience" className="relative pl-6 border-l-2" style={{ borderColor: `${secondaryColor}30` }}>
                      <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                      <div className="flex justify-between items-baseline gap-4 mb-2">
                        <h3 className="font-bold text-gray-900">{exp.position}</h3>
                        <span className="text-[10px] font-bold opacity-50 shrink-0 whitespace-nowrap">{formatDateShort(exp.start_date)} — {exp.current ? 'PRESENT' : formatDateShort(exp.end_date)}</span>
                      </div>
                      <p className="text-xs font-bold mb-3" style={{ color: secondaryColor }}>{exp.company}</p>
                      <ul className="space-y-2">
                        {getVisibleBullets(exp).map((bullet, bIdx) => (
                          <li key={bIdx} className="text-sm text-gray-600 leading-relaxed flex gap-3">
                            <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />
                            {bullet}
                          </li>
                        ))}
                      </ul>

                              {(exp.displayMode || 'normal') === 'extended' && exp.kpi && (
                                <p className="text-xs font-bold mt-2" style={{ color: primaryColor }}>📈 {exp.kpi}</p>
                              )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="grid grid-cols-2 gap-12">
              {includedSections.includes('skills') && (
                <section data-cv-section="skills">
                  <div className="flex items-center gap-4 mb-6">
                    <h2 className={cn(sectionTitleClasses)} style={{ color: primaryColor, fontSize: '0.75rem' }}>Compétences</h2>
                    <div className="flex-1 h-[2px]" style={{ backgroundColor: `${primaryColor}20` }} />
                  </div>
                  <div className="space-y-4">
                    {cvData.skills?.filter(cat => (cat.displayMode || "normal") !== "hidden").map((cat, idx) => (
                      <div key={idx}>
                        <p className="text-[10px] font-bold uppercase mb-1 opacity-40">{cat.category}</p>
                        <p className="text-sm text-gray-700">{getVisibleSkills(cat).join(' • ') || ''}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {includedSections.includes('education') && (
                <section data-cv-section="education">
                  <div className="flex items-center gap-4 mb-6">
                    <h2 className={cn(sectionTitleClasses)} style={{ color: primaryColor, fontSize: '0.75rem' }}>Formation</h2>
                    <div className="flex-1 h-[2px]" style={{ backgroundColor: `${primaryColor}20` }} />
                  </div>
                  <div className="space-y-4">
                    {cvData.education?.map((edu, idx) => (
                      <div key={idx}>
                        <p className="text-sm font-bold text-gray-900">{edu.degree}</p>
                        <p className="text-xs text-gray-500">{edu.school} | {edu.end_date}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {includedSections.includes('languages') && (cvData.languages?.length || 0) > 0 && (
              <section data-cv-section="languages">
                <div className="flex items-center gap-4 mb-6">
                  <h2 className={cn(sectionTitleClasses)} style={{ color: primaryColor, fontSize: '0.75rem' }}>Langues</h2>
                  <div className="flex-1 h-[2px]" style={{ backgroundColor: `${primaryColor}20` }} />
                </div>
                <div className="flex flex-wrap gap-x-12 gap-y-4">
                  {cvData.languages?.map((lang, idx) => (
                    <div key={idx} className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900">{lang.name}</span>
                      <span className="text-[10px] font-bold uppercase opacity-40">{lang.proficiency}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      );
    }

    if (selectedTemplate === 'TEMPLATE_F') {
      return (
        <div style={commonStyles} className={cn("w-full h-full bg-white grid grid-cols-[260px_1fr] pdf-safe", fontClass)}>
          <aside className="p-12 border-r border-gray-100 space-y-12" style={{ backgroundColor: `${primaryColor}05` }}>
            {includedSections.includes('personal') && (
              <div className="space-y-4">
                {showPhoto && cvData.personal_info?.photo_url ? (
                  renderPhoto("w-20 h-20 rounded-full border-2 border-white")
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    <User className="w-10 h-10 text-gray-400" />
                  </div>
                )}
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold leading-tight" style={{ color: primaryColor }}>{cvData.personal_info?.name}</h1>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">{cvData.personal_info?.title}</p>
                </div>
              </div>
            )}

            {includedSections.includes('personal') && (
              <section data-cv-section="contact" className="space-y-4">
                <h2 className={cn("border-b pb-2", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20`, fontSize: '10px' }}>Contact</h2>
                <div className="space-y-3 text-[11px] text-gray-600">
                  <p className="flex items-center gap-2"><Mail className="w-3 h-3" /> {cvData.personal_info?.email}</p>
                  {cvData.personal_info?.phone && <p className="flex items-center gap-2"><Phone className="w-3 h-3" /> {cvData.personal_info?.phone}</p>}
                  {cvData.personal_info?.location && <p className="flex items-center gap-2"><MapPin className="w-3 h-3" /> {cvData.personal_info?.location}</p>}
                </div>
              </section>
            )}

            {includedSections.includes('skills') && (
              <section data-cv-section="skills" className="space-y-4">
                <h2 className={cn("border-b pb-2", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20`, fontSize: '10px' }}>Compétences</h2>
                <div className="space-y-4">
                  {cvData.skills?.filter(cat => (cat.displayMode || "normal") !== "hidden").map((cat, idx) => (
                    <div key={idx} className="space-y-1">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">{cat.category}</p>
                      <div className="flex flex-wrap gap-1">
                        {getVisibleSkills(cat).map(skill => (
                          <span key={skill} className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-[9px] text-gray-600">{skill}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {includedSections.includes('education') && (
              <section data-cv-section="education" className="space-y-4">
                <h2 className={cn("border-b pb-2", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20`, fontSize: '10px' }}>Formation</h2>
                <div className="space-y-4">
                  {cvData.education?.map((edu, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <p className="text-[11px] font-bold text-gray-900">{edu.degree}</p>
                      <p className="text-[10px] text-gray-500">{edu.school}</p>
                      <p className="text-[9px] font-mono text-gray-400">{edu.end_date}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {includedSections.includes('languages') && (cvData.languages?.length || 0) > 0 && (
              <section data-cv-section="languages" className="space-y-4">
                <h2 className={cn("border-b pb-2", sectionTitleClasses)} style={{ color: primaryColor, borderColor: `${primaryColor}20`, fontSize: '10px' }}>Langues</h2>
                <div className="space-y-3">
                  {cvData.languages?.map((lang, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-gray-900">{lang.name}</span>
                      <span className="text-[9px] uppercase tracking-widest text-gray-400">{lang.proficiency}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </aside>

          <main className="p-12 space-y-12">
            {includedSections.includes('summary') && cvData.personal_info?.summary && (
              <section data-cv-section="summary" className="space-y-4">
                <div className="flex items-center gap-4">
                  <h2 className={cn(sectionTitleClasses)} style={{ color: primaryColor, fontSize: '0.875rem' }}>Profil</h2>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{cvData.personal_info?.summary}</p>
              </section>
            )}

            {includedSections.includes('experience') && (
              <section data-cv-section="experience" className="space-y-8">
                <div className="flex items-center gap-4">
                  <h2 className={cn(sectionTitleClasses)} style={{ color: primaryColor, fontSize: '0.875rem' }}>Expérience</h2>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
                <div className="space-y-10">
                  {cvData.experience?.filter(e => (e.displayMode || "normal") !== "hidden").map((exp, idx) => (
                    <div key={idx} data-cv-block="experience" className="space-y-3">
                      <div className="flex justify-between items-baseline gap-4">
                        <h3 className="text-lg font-bold text-gray-900 min-w-0">{exp.position}</h3>
                        <span className="text-[10px] font-bold text-gray-400 shrink-0 whitespace-nowrap">{formatDateShort(exp.start_date)} — {exp.current ? 'PRESENT' : formatDateShort(exp.end_date)}</span>
                      </div>
                      <p className="text-sm font-medium" style={{ color: secondaryColor }}>{exp.company}</p>
                      <ul className="space-y-2">
                        {getVisibleBullets(exp).map((bullet, bIdx) => (
                          <li key={bIdx} className="text-sm text-gray-600 leading-relaxed flex gap-3">
                            <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: secondaryColor }} />
                            {bullet}
                          </li>
                        ))}
                      </ul>

                              {(exp.displayMode || 'normal') === 'extended' && exp.kpi && (
                                <p className="text-xs font-bold mt-2" style={{ color: primaryColor }}>📈 {exp.kpi}</p>
                              )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      );
    }

    return null;
  };

  const handleOptimize = async () => {
    if (!cvData) return;
    setIsOptimizing(true);
    
    try {
      const optimizedData = await optimizeCVAction({
        cvData,
        pageLimit: designSettings.pageLimit || 1,
      });
      
      // Update state with optimized data
      setCvData(optimizedData);
      setNotification({ message: 'CV optimisé avec succès !', type: 'success' });
      
      // Save automatically
      if (user) {
        await storeUser();
      } else if (isGuest) {
        localStorage.setItem('guest_last_optimized', JSON.stringify(optimizedData));
      }
      
    } catch (error) {
      console.error('Error optimizing CV:', error);
      setNotification({ message: 'Erreur lors de l\'optimisation du CV.', type: 'error' });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!cvData) return;
    
    setIsSaving(true);
    try {
      const updatedCvData = { ...cvData, design: { ...designSettings, template: selectedTemplate } };
      
      if (user) {
        await storeUser();
        
        // Also save to a historical collection for "Mes CV"
        await createCV({
          personal_info: updatedCvData.personal_info,
          experience: updatedCvData.experience,
          education: updatedCvData.education,
          skills: updatedCvData.skills,
          languages: updatedCvData.languages,
          design: updatedCvData.design
        });
      } else if (isGuest) {
        // Save to local storage for guests
        localStorage.setItem('guest_last_optimized', JSON.stringify(updatedCvData));
        
        // Also add to guest_cvs list
        const guestCVs = JSON.parse(localStorage.getItem('guest_cvs') || '[]');
        const newGuestCV = {
          ...updatedCvData,
          _id: `guest_${Date.now()}`,
          createdAt: new Date().toISOString()
        };
        localStorage.setItem('guest_cvs', JSON.stringify([newGuestCV, ...guestCVs]));
      }
      
      setNotification({ message: 'Brouillon sauvegardé !', type: 'success' });
    } catch (error) {
      console.error('Error saving draft:', error);
      setNotification({ message: 'Erreur lors de la sauvegarde.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Inject a temporary stylesheet that overrides ALL oklch Tailwind v4 color variables to hex
  const handleDownloadPDF = async () => {
    if (!cvRef.current) return;
    setIsExporting(true);
    
    // Scroll preview container to top to ensure full capture
    if (previewContainerRef.current) {
      previewContainerRef.current.scrollTo(0, 0);
    }
    
    // Small delay to ensure any layout shifts are settled
    await new Promise(resolve => setTimeout(resolve, 150));
    
    try {
      const { pdf } = await renderPDF({
        cvElement: cvRef.current,
        designSettings,
      });
      pdf.save(`CV_Optimise_${cvData?.personal_info?.name?.replace(/\s+/g, '_') || 'Builder'}.pdf`);
      setNotification({ message: 'Téléchargement lancé !', type: 'success' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      setNotification({ message: 'Erreur lors de l\'export PDF.', type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreviewPDF = async () => {
    if (!cvRef.current) return;
    setIsPreviewing(true);
    
    if (previewContainerRef.current) {
      previewContainerRef.current.scrollTo(0, 0);
    }
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    try {
      const { url } = await renderPDF({
        cvElement: cvRef.current,
        designSettings,
      });
      setPreviewUrl(url);
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      setNotification({ message: 'Erreur lors de l\'aperçu.', type: 'error' });
    } finally {
      setIsPreviewing(false);
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

  return (
    <div className="stitch-container relative">
      {/* Notifications */}
      {notification && (
        <div className={cn(
          "fixed top-6 right-6 z-[300] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300",
          notification.type === 'success' ? "bg-green-600 text-white" : "bg-red-600 text-white"
        )}>
          {notification.type === 'success' ? <Zap className="w-4 h-4" /> : <X className="w-4 h-4" />}
          <span className="text-xs font-bold stitch-mono uppercase tracking-widest">{notification.message}</span>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex flex-col items-center justify-center p-4 lg:p-12">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="p-4 border-b flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">APERÇU_PDF_FINAL</h3>
                  <p className="text-[10px] text-gray-500 stitch-mono">Vérifiez le rendu avant l'exportation</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleDownloadPDF}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold stitch-mono hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  TÉLÉCHARGER
                </button>
                <button 
                  onClick={() => {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-200 overflow-hidden relative">
              <iframe 
                src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
                className="w-full h-full border-none"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showTemplateConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-blue-600">
              <LayoutIcon className="w-6 h-6" />
              <h3 className="text-lg font-bold">Changer de modèle ?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Vous êtes sur le point de passer au modèle <span className="font-bold text-gray-900">{pendingTemplate ? TEMPLATE_NAMES[pendingTemplate] || pendingTemplate : ''}</span>. 
              Votre contenu sera conservé, mais certains réglages de design (polices, espacements) seront automatiquement ajustés pour correspondre au style du nouveau modèle.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowTemplateConfirm(false);
                  setPendingTemplate(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={confirmTemplateChange}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
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
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex border-b border-[#DADCE0] shrink-0">
            <button 
              onClick={() => setActiveTab('content')}
              className={cn(
                "flex-1 py-3 text-[10px] stitch-mono font-bold uppercase tracking-widest transition-colors",
                activeTab === 'content' ? "bg-white text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-100"
              )}
            >
              Contenu
            </button>
            <button 
              onClick={() => setActiveTab('design')}
              className={cn(
                "flex-1 py-3 text-[10px] stitch-mono font-bold uppercase tracking-widest transition-colors",
                activeTab === 'design' ? "bg-white text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:bg-gray-100"
              )}
            >
              Design
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 scrollbar-thin">
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
                      <select 
                        value={designSettings.pageLimit}
                        onChange={(e) => {
                          setDesignSettings(prev => ({ ...prev, pageLimit: parseInt(e.target.value) as 1 | 2 | 3 | 4 }));
                          setUserModified(false);
                          fitIterations.current = 0;
                        }}
                        className="bg-white border border-blue-200 rounded text-[10px] px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                      </select>
                    </div>
                  </div>

                  {/* Job description for scoring */}
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Collez l'offre d'emploi ici pour le scoring de pertinence..."
                    rows={2}
                    className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-[9px] stitch-mono focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                  />

                  {/* Auto-assign button */}
                  <button
                    onClick={() => {
                      if (!cvData) return;
                      const keywords = extractKeywords(jobDescription);
                      const autoExperiences = autoAssignModes(cvData.experience, keywords, designSettings.pageLimit || 1);
                      setCvData(prev => prev ? { ...prev, experience: autoExperiences } : null);
                      setUserModified(false);
                      fitIterations.current = 0;
                    }}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    disabled={!cvData}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span className="text-[9px] stitch-mono font-bold uppercase tracking-widest">
                      AUTO-ASSIGNATION
                    </span>
                  </button>

                  {/* AI content optimization button */}
                  <button
                    onClick={handleOptimize}
                    disabled={isOptimizing}
                    className="w-full py-2 px-4 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isOptimizing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span className="text-[9px] stitch-mono font-bold uppercase tracking-widest">
                      {isOptimizing ? 'OPTIMISATION...' : 'RÉÉCRIRE CONTENU (IA)'}
                    </span>
                  </button>
                  
                  {/* Overflow warning — always shown when content overflows */}
                  {overflowPx > 0 && (
                    <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[9px] stitch-mono text-red-600 space-y-1">
                      <p className="font-bold uppercase tracking-wider">⚠ DÉPASSE DE ~{Math.round(overflowPx / 11.23 * 10) / 10}mm</p>
                      <p className="text-red-500">
                        {userModified 
                          ? "Passez des blocs en compact ou augmentez les pages."
                          : "Lancez l'auto-assignation ou augmentez le nombre de pages."}
                      </p>
                    </div>
                  )}
                  {overflowPx === 0 && cvData && (
                    <div className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-[9px] stitch-mono text-green-600 font-bold uppercase tracking-wider">
                      ✓ Contenu tient sur {designSettings.pageLimit} page(s)
                    </div>
                  )}
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
                      <div>
                        <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-1">Nom complet</label>
                        <input 
                          type="text" 
                          value={cvData?.personal_info?.name || ''} 
                          onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, name: e.target.value}} : null)}
                          className="stitch-input stitch-mono text-xs" 
                        />
                      </div>
                      <div>
                        <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-1">Titre pro</label>
                        <input 
                          type="text" 
                          value={cvData?.personal_info?.title || ''} 
                          onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, title: e.target.value}} : null)}
                          className="stitch-input stitch-mono text-xs" 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-1">Email</label>
                          <input 
                            type="email" 
                            value={cvData?.personal_info?.email || ''} 
                            onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, email: e.target.value}} : null)}
                            className="stitch-input stitch-mono text-[10px]" 
                          />
                        </div>
                        <div>
                          <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-1">Téléphone</label>
                          <input 
                            type="text" 
                            value={cvData?.personal_info?.phone || ''} 
                            onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, phone: e.target.value}} : null)}
                            className="stitch-input stitch-mono text-[10px]" 
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-1">Localisation</label>
                          <input 
                            type="text" 
                            value={cvData?.personal_info?.location || ''} 
                            onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, location: e.target.value}} : null)}
                            className="stitch-input stitch-mono text-[10px]" 
                            placeholder="Ex: Paris, France"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-1">LinkedIn URL</label>
                          <input 
                            type="text" 
                            value={cvData?.personal_info?.linkedin || ''} 
                            onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, linkedin: e.target.value}} : null)}
                            className="stitch-input stitch-mono text-[10px]" 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-1">Photo de profil (URL ou Upload)</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={cvData?.personal_info?.photo_url || ''} 
                            onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, photo_url: e.target.value}} : null)}
                            className="stitch-input stitch-mono text-[10px] flex-1" 
                            placeholder="https://..."
                          />
                          <label className="px-3 py-1 bg-gray-100 border border-gray-200 rounded text-[9px] stitch-mono cursor-pointer hover:bg-gray-200 transition-colors flex items-center">
                            UPLOAD
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    const base64String = reader.result as string;
                                    setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, photo_url: base64String}} : null);
                                  };
                                  reader.readAsDataURL(file);
                                }
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
                      <div>
                        <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-1">Résumé professionnel</label>
                        <textarea 
                          rows={4}
                          value={cvData?.personal_info?.summary || ''} 
                          onChange={(e) => setCvData(prev => prev ? {...prev, personal_info: {...prev.personal_info, summary: e.target.value}} : null)}
                          className="stitch-input stitch-mono text-xs w-full resize-none" 
                          placeholder="Décrivez brièvement votre parcours et vos objectifs..."
                        />
                      </div>
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
                              {jobDescription && (
                                <span className="text-[7px] stitch-mono ml-1 px-1 py-0.5 rounded" style={{
                                  backgroundColor: (() => {
                                    const s = scoreExperience(exp, extractKeywords(jobDescription));
                                    return s >= 70 ? '#dcfce7' : s >= 40 ? '#fef9c3' : '#fee2e2';
                                  })(),
                                  color: (() => {
                                    const s = scoreExperience(exp, extractKeywords(jobDescription));
                                    return s >= 70 ? '#166534' : s >= 40 ? '#854d0e' : '#991b1b';
                                  })(),
                                }}>
                                  {scoreExperience(exp, extractKeywords(jobDescription))}%
                                </span>
                              )}
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
                          <input 
                            className="w-full bg-transparent font-bold text-[11px] mb-1 focus:outline-none"
                            value={exp.position}
                            onChange={(e) => {
                              const newExp = [...(cvData?.experience || [])];
                              newExp[idx].position = e.target.value;
                              setCvData(prev => prev ? {...prev, experience: newExp} : null);
                            }}
                          />
                          <input 
                            className="w-full bg-transparent text-[10px] text-blue-600 focus:outline-none"
                            value={exp.company}
                            onChange={(e) => {
                              const newExp = [...(cvData?.experience || [])];
                              newExp[idx].company = e.target.value;
                              setCvData(prev => prev ? {...prev, experience: newExp} : null);
                            }}
                          />
                          <div className="grid grid-cols-3 gap-2 mt-1">
                            <input
                              className="bg-white border border-gray-200 rounded px-2 py-1 text-[9px] font-mono focus:outline-none focus:border-blue-600"
                              value={exp.start_date}
                              placeholder="Début"
                              onChange={(e) => {
                                const newExp = [...(cvData?.experience || [])];
                                newExp[idx].start_date = e.target.value;
                                setCvData(prev => prev ? {...prev, experience: newExp} : null);
                              }}
                            />
                            <input
                              className="bg-white border border-gray-200 rounded px-2 py-1 text-[9px] font-mono focus:outline-none focus:border-blue-600 disabled:opacity-40"
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

                          {/* ─── KPI field (extended mode only) ─── */}
                          {(exp.displayMode || 'normal') === 'extended' && (
                            <div className="mt-2">
                              <label className="text-[7px] stitch-mono text-emerald-600 uppercase block mb-0.5">KPI / Résultat clé</label>
                              <input
                                className="w-full bg-white border border-emerald-200 rounded px-2 py-1 text-[9px] focus:outline-none focus:border-emerald-500"
                                value={exp.kpi || ''}
                                placeholder="Ex: +35% de CA, 12 personnes managées..."
                                onChange={(e) => {
                                  const newExp = [...(cvData?.experience || [])];
                                  newExp[idx] = { ...newExp[idx], kpi: e.target.value };
                                  setCvData(prev => prev ? {...prev, experience: newExp} : null);
                                }}
                              />
                            </div>
                          )}

                          {/* ─── Bullet points (hidden in compact mode) ─── */}
                          {(exp.displayMode || 'normal') !== 'compact' && (
                            <div className="space-y-1 mt-2">
                              {exp.description?.map((bullet, bIdx) => {
                                const bulletKey = `${idx}-${bIdx}`;
                                return (
                                <div key={bIdx} className="space-y-1">
                                  <div className="flex items-center gap-1 group/bullet">
                                    <input 
                                      className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[9px] focus:outline-none focus:border-blue-600"
                                      value={bullet}
                                      onChange={(e) => {
                                        const newExp = [...(cvData?.experience || [])];
                                        newExp[idx].description[bIdx] = e.target.value;
                                        setCvData(prev => prev ? {...prev, experience: newExp} : null);
                                      }}
                                    />
                                    <button
                                      title="Améliorer avec l'IA"
                                      disabled={improvingBullet === bulletKey}
                                      onClick={async () => {
                                        setImprovingBullet(bulletKey);
                                        setBulletSuggestions(null);
                                        try {
                                          const result = await improveBulletAction({
                                            bullet,
                                            position: exp.position,
                                            company: exp.company,
                                          });
                                          setBulletSuggestions({ key: bulletKey, suggestions: result.suggestions || [] });
                                        } catch { /* ignore */ }
                                        setImprovingBullet(null);
                                      }}
                                      className="p-1 text-gray-300 hover:text-blue-500 opacity-0 group-hover/bullet:opacity-100 transition-opacity"
                                    >
                                      {improvingBullet === bulletKey
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
                                  {bulletSuggestions?.key === bulletKey && (
                                    <div className="ml-2 p-2 bg-blue-50 border border-blue-100 rounded space-y-1 animate-in fade-in duration-200">
                                      <p className="text-[8px] font-mono text-blue-500 uppercase tracking-wider mb-1">Suggestions IA</p>
                                      {bulletSuggestions.suggestions.map((sug, sIdx) => (
                                        <button
                                          key={sIdx}
                                          onClick={() => {
                                            const newExp = [...(cvData?.experience || [])];
                                            newExp[idx].description[bIdx] = sug;
                                            setCvData(prev => prev ? {...prev, experience: newExp} : null);
                                            setBulletSuggestions(null);
                                          }}
                                          className="w-full text-left px-2 py-1 text-[9px] text-gray-700 hover:bg-blue-100 rounded transition-colors"
                                        >
                                          {sug}
                                        </button>
                                      ))}
                                      <button
                                        onClick={() => setBulletSuggestions(null)}
                                        className="text-[8px] font-mono text-gray-400 hover:text-gray-600 mt-1"
                                      >
                                        Fermer
                                      </button>
                                    </div>
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
                              <input
                                className="w-full bg-white border border-amber-200 rounded px-2 py-1 text-[9px] focus:outline-none focus:border-amber-500"
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
                          <input 
                            className="w-full bg-transparent font-bold text-[10px] stitch-mono uppercase focus:outline-none"
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
                          <input 
                            type="text" 
                            placeholder="Ajouter compétence..."
                            className="w-full bg-white border border-[#DADCE0] rounded px-2 py-1 text-[9px] stitch-mono focus:outline-none focus:border-blue-600"
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
                          <input 
                            className="w-full bg-transparent font-bold text-[11px] focus:outline-none"
                            value={edu.degree}
                            placeholder="Diplôme"
                            onChange={(e) => {
                              const newEdu = [...(cvData?.education || [])];
                              newEdu[idx].degree = e.target.value;
                              setCvData(prev => prev ? {...prev, education: newEdu} : null);
                            }}
                          />
                          <input 
                            className="w-full bg-transparent text-[10px] text-blue-600 focus:outline-none"
                            value={edu.school}
                            placeholder="École"
                            onChange={(e) => {
                              const newEdu = [...(cvData?.education || [])];
                              newEdu[idx].school = e.target.value;
                              setCvData(prev => prev ? {...prev, education: newEdu} : null);
                            }}
                          />
                          <input 
                            className="w-full bg-transparent text-[9px] text-gray-400 focus:outline-none"
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
                          <input 
                            className="w-full bg-transparent font-bold text-[11px] focus:outline-none"
                            value={lang.name}
                            placeholder="Langue"
                            onChange={(e) => {
                              const newLang = [...(cvData?.languages || [])];
                              newLang[idx].name = e.target.value;
                              setCvData(prev => prev ? {...prev, languages: newLang} : null);
                            }}
                          />
                          <select 
                            className="w-full bg-transparent text-[10px] text-blue-600 focus:outline-none"
                            value={lang.proficiency}
                            onChange={(e) => {
                              const newLang = [...(cvData?.languages || [])];
                              newLang[idx].proficiency = e.target.value;
                              setCvData(prev => prev ? {...prev, languages: newLang} : null);
                            }}
                          >
                            <option value="Natif">Natif</option>
                            <option value="Courant">Courant</option>
                            <option value="Intermédiaire">Intermédiaire</option>
                            <option value="Débutant">Débutant</option>
                          </select>
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
            ) : (
              <div className="space-y-6">
                <section className="stitch-panel">
                  <div className="stitch-panel-header">01. TEMPLATE_SELECTION</div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    {[
                      { id: 'TEMPLATE_A', name: 'Classic', desc: 'Minimaliste & Efficace' },
                      { id: 'TEMPLATE_B', name: 'Modern', desc: 'Design & Impact' },
                      { id: 'TEMPLATE_C', name: 'Minimal', desc: 'Sérieux & Professionnel' },
                      { id: 'TEMPLATE_D', name: 'Creative', desc: 'Audacieux & Unique' },
                      { id: 'TEMPLATE_E', name: 'Elegant', desc: 'Haut de gamme' },
                      { id: 'TEMPLATE_F', name: 'Sidebar', desc: 'Structure & Clarté' }
                    ].map((tpl) => (
                      <div 
                        key={tpl.id}
                        onClick={() => {
                          if (selectedTemplate !== tpl.id) {
                            setPendingTemplate(tpl.id as any);
                            setShowTemplateConfirm(true);
                          }
                        }}
                        className={cn(
                          "stitch-panel p-2 cursor-pointer transition-all flex flex-col gap-2",
                          selectedTemplate === tpl.id ? "border-blue-600 ring-1 ring-blue-600 bg-blue-50/30" : "opacity-60 hover:opacity-100 hover:bg-gray-50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn("text-[9px] font-bold stitch-mono uppercase", selectedTemplate === tpl.id ? "text-blue-600" : "text-gray-900")}>{tpl.name}</span>
                          {selectedTemplate === tpl.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                        </div>
                        <div className="h-12 bg-white border border-gray-100 rounded flex items-center justify-center overflow-hidden">
                           <div className={cn(
                             "w-full h-full opacity-20",
                             tpl.id === 'TEMPLATE_A' && "bg-gray-400",
                             tpl.id === 'TEMPLATE_B' && "bg-blue-400",
                             tpl.id === 'TEMPLATE_C' && "bg-indigo-400",
                             tpl.id === 'TEMPLATE_D' && "bg-orange-400",
                             tpl.id === 'TEMPLATE_E' && "bg-emerald-400",
                             tpl.id === 'TEMPLATE_F' && "bg-slate-400"
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
                    {[
                      { name: 'Corporate', p: '#1e293b', s: '#64748b', f: 'sans' },
                      { name: 'Creative', p: '#f97316', s: '#0f172a', f: 'outfit' },
                      { name: 'Elegant', p: '#111827', s: '#94a3b8', f: 'playfair' },
                      { name: 'Tech', p: '#2563eb', s: '#475569', f: 'mono' }
                    ].map((theme) => (
                      <button
                        key={theme.name}
                        onClick={() => setDesignSettings(prev => ({ 
                          ...prev, 
                          primaryColor: theme.p, 
                          secondaryColor: theme.s,
                          fontFamily: theme.f as any
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
                        <input 
                          type="text" 
                          value={designSettings.primaryColor}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                          className="stitch-input stitch-mono text-[10px] py-1"
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
                        <input 
                          type="text" 
                          value={designSettings.secondaryColor}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                          className="stitch-input stitch-mono text-[10px] py-1"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="stitch-panel">
                  <div className="stitch-panel-header">05. TYPOGRAPHY</div>
                  <div className="p-4 space-y-3">
                    {[
                      { id: 'sans', name: 'Inter (Sans)' },
                      { id: 'serif', name: 'Georgia (Serif)' },
                      { id: 'mono', name: 'JetBrains (Mono)' },
                      { id: 'playfair', name: 'Playfair (Display)' },
                      { id: 'outfit', name: 'Outfit (Modern)' }
                    ].map((font) => (
                      <button
                        key={font.id}
                        onClick={() => setDesignSettings(prev => ({ ...prev, fontFamily: font.id as any }))}
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
                        {['normal', 'medium', 'semibold', 'bold', 'black'].map((weight) => (
                          <button
                            key={weight}
                            onClick={() => setDesignSettings(prev => ({ ...prev, sectionTitleWeight: weight as any }))}
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
                        {['none', 'uppercase', 'capitalize'].map((transform) => (
                          <button
                            key={transform}
                            onClick={() => setDesignSettings(prev => ({ ...prev, sectionTitleTransform: transform as any }))}
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
                        {['tight', 'normal', 'wide', 'wider', 'widest'].map((spacing) => (
                          <button
                            key={spacing}
                            onClick={() => setDesignSettings(prev => ({ ...prev, sectionTitleSpacing: spacing as any }))}
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
                      <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-2">Page Limit & Options</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map((limit) => (
                          <button
                            key={limit}
                            onClick={() => setDesignSettings(prev => ({ ...prev, pageLimit: limit as 1 | 2 | 3 | 4 }))}
                            className={cn(
                              "px-2 py-1 rounded border text-[9px] stitch-mono transition-colors capitalize",
                              designSettings.pageLimit === limit 
                                ? "bg-blue-50 border-blue-200 text-blue-700 font-bold" 
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            )}
                          >
                            {limit} Page{limit > 1 ? 's' : ''}
                          </button>
                        ))}
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
                      <div>
                        <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-2">Format</label>
                        <select 
                          value={designSettings.paperSize}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, paperSize: e.target.value as any }))}
                          className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-[10px] stitch-mono focus:outline-none focus:border-blue-500"
                        >
                          <option value="a4">A4</option>
                          <option value="letter">Letter</option>
                          <option value="legal">Legal</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] stitch-mono text-gray-500 uppercase block mb-2">Orientation</label>
                        <select 
                          value={designSettings.orientation}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, orientation: e.target.value as any }))}
                          className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-[10px] stitch-mono focus:outline-none focus:border-blue-500"
                        >
                          <option value="portrait">Portrait</option>
                          <option value="landscape">Paysage</option>
                        </select>
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
                    <button
                      onClick={handlePreviewPDF}
                      disabled={isPreviewing}
                      className="w-full py-3 px-4 bg-white border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                    >
                      {isPreviewing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                      <span className="text-[10px] stitch-mono font-bold uppercase tracking-widest">
                        {isPreviewing ? 'GÉNÉRATION...' : 'PRÉVISUALISER_PDF'}
                      </span>
                    </button>
                    
                    <button
                      onClick={handleDownloadPDF}
                      disabled={isExporting}
                      className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                    >
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span className="text-[10px] stitch-mono font-bold uppercase tracking-widest">
                        {isExporting ? 'EXPORTATION...' : 'TÉLÉCHARGER_PDF'}
                      </span>
                    </button>

                    <button
                      onClick={async () => {
                        if (!cvData) return;
                        const { exportToDocx } = await import('../shared/lib/export-docx');
                        await exportToDocx(cvData);
                        setNotification({ message: 'DOCX téléchargé !', type: 'success' });
                      }}
                      className="w-full py-3 px-4 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2 group"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-[10px] stitch-mono font-bold uppercase tracking-widest">
                        TÉLÉCHARGER_DOCX
                      </span>
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[#DADCE0] bg-white">
          <button 
            onClick={handleSaveDraft}
            disabled={isSaving || !cvData}
            className="w-full stitch-button-secondary flex items-center justify-center space-x-2 mb-2 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            <span className="text-[10px] stitch-mono">SAVE_DRAFT</span>
          </button>
          <button 
            onClick={handleDownloadPDF}
            disabled={isExporting || !cvData}
            className="w-full stitch-button-primary flex items-center justify-center space-x-2"
          >
            {isExporting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            <span className="text-[10px] stitch-mono">EXPORT_PDF</span>
          </button>
        </div>
      </aside>

      {/* Main Preview Area (Stitch Style) */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#F1F3F4] min-h-0 relative">
        <header className="stitch-header justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={cn(
                "p-2 hover:bg-gray-100 rounded-lg transition-colors",
                isSidebarOpen ? "md:hidden" : ""
              )}
            >
              <LayoutIcon className="w-5 h-5 text-gray-500" />
            </button>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <Link to="/dashboard" className="hover:text-gray-900 transition-colors">Console</Link>
              <span className="text-gray-300">/</span>
              <span className="text-gray-900 font-medium">EDITOR_V2</span>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center bg-white border border-[#DADCE0] rounded-full px-3 py-1 gap-4 shadow-sm">
            <div className="flex items-center gap-2 border-r border-gray-100 pr-3">
              <button 
                onClick={() => {
                  setZoom(prev => Math.max(30, prev - 10));
                  setIsAutoZoom(false);
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Zoom arrière"
              >
                <ChevronDown className="w-3 h-3 rotate-90" />
              </button>
              <span className="text-[10px] stitch-mono font-bold w-8 text-center">{zoom}%</span>
              <button 
                onClick={() => {
                  setZoom(prev => Math.min(150, prev + 10));
                  setIsAutoZoom(false);
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Zoom avant"
              >
                <ChevronUp className="w-3 h-3 rotate-90" />
              </button>
              <button 
                onClick={() => setIsAutoZoom(prev => !prev)}
                className={cn(
                  "ml-1 p-1 rounded transition-colors",
                  isAutoZoom ? "bg-blue-50 text-blue-600" : "hover:bg-gray-100 text-gray-500"
                )}
                title={isAutoZoom ? "Désactiver le zoom auto" : "Activer le zoom auto"}
              >
                <LayoutIcon className="w-3 h-3" />
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[9px] stitch-mono text-gray-400 uppercase">Format:</span>
              <span className="text-[10px] stitch-mono font-bold text-blue-600">A4_ISO</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button 
              onClick={handleSaveDraft}
              disabled={isSaving || !cvData}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              title="Sauvegarder le brouillon"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="text-[10px] stitch-mono font-bold hidden sm:inline">SAVE</span>
            </button>
            <button 
              onClick={handleDownloadPDF}
              disabled={isExporting || !cvData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
              title="Exporter en PDF"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="text-[10px] stitch-mono font-bold hidden sm:inline">EXPORT</span>
            </button>
          </div>
        </header>

        <div 
          ref={previewContainerRef}
          className="flex-1 overflow-auto p-4 sm:p-8 lg:p-12 flex flex-col items-center min-h-0 relative scroll-smooth bg-[#F1F3F4]"
        >
          {/* Scaled Wrapper — height = pageLimit × A4 height */}
          <div 
            style={{ 
              width: `${210 * (zoom / 100)}mm`,
              height: `${297 * (designSettings.pageLimit || 1) * (zoom / 100)}mm`,
              minHeight: `${297 * (designSettings.pageLimit || 1) * (zoom / 100)}mm`,
              marginBottom: '100px'
            }}
            className="relative shrink-0"
          >
            <div 
              ref={cvRef}
              style={{ 
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
                width: '210mm',
                height: `${297 * (designSettings.pageLimit || 1)}mm`,
                position: 'absolute',
                top: 0,
                left: 0
              }}
              className={cn(
                "bg-white shadow-2xl border border-[#DADCE0] pdf-safe overflow-hidden",
              )}
            >
              {/* Page break indicators for pages 2+ */}
              {Array.from({ length: (designSettings.pageLimit || 1) - 1 }, (_, i) => (
                <div 
                  key={i}
                  className="absolute left-0 w-full border-t-2 border-dashed border-blue-300 z-50 pointer-events-none"
                  style={{ top: `${297 * (i + 1)}mm` }}
                >
                  <div className="absolute top-0 right-0 bg-blue-50 text-blue-500 text-[8px] px-2 py-0.5 rounded-bl font-mono uppercase tracking-wider">
                    Page {i + 2}
                  </div>
                </div>
              ))}
              {cvData ? renderCV() : (
                <div className="h-full flex items-center justify-center p-8">
                  <div className="text-center max-w-sm">
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
          </div>
        </div>
      </main>
    </div>
  );
}
