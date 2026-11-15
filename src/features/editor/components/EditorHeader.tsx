import { useEffect, useRef } from 'react';
import { Layout as LayoutIcon, Save, Copy, Download, Loader2, Minus, Plus, Maximize2, EyeOff, Eye, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/src/shared/lib/cn';
import { Logo } from '@/src/shared/ui/Logo';
import { LanguageSelector } from '@/src/shared/ui/LanguageSelector';

interface Props {
  document: 'cv' | 'letter';
  onOpenCV: () => void; onOpenCoverLetter: () => void;
  isSidebarOpen: boolean; onToggleSidebar: () => void;
  zoom: number; isAutoZoom: boolean; onZoomIn: () => void; onZoomOut: () => void; onToggleAutoZoom: () => void;
  onSave: () => void; onExport: () => void; onExportDocx: () => void; onPreviewPDF: () => void; onExportText: () => void;
  isExportingDocx: boolean; isSaving: boolean; isExporting: boolean; hasCvData: boolean; canOpenLetter: boolean;
  currentLanguage: 'fr' | 'en'; letterLanguage: 'fr' | 'en'; onLanguageChange: (lang: 'fr' | 'en') => void;
  isLanguageLocked?: boolean; isAnonymous: boolean; onToggleAnonymous: () => void;
  isAutoSaving?: boolean; lastAutoSaveAt?: Date | null; autoSaveFailed?: boolean; isFitting?: boolean;
  letterSaveLabel: string; onRetrySave: () => void;
  onUndo: () => void; canUndo: boolean;
}

/** The same mounted header and action slots for both documents, independent of either sidebar. */
export function EditorHeader({
  document: activeDocument, onOpenCV, onOpenCoverLetter, isSidebarOpen, onToggleSidebar,
  zoom, isAutoZoom, onZoomIn, onZoomOut, onToggleAutoZoom,
  onSave, onExport, onExportDocx, onPreviewPDF, onExportText,
  isExportingDocx, isSaving, isExporting, hasCvData, canOpenLetter,
  currentLanguage, letterLanguage, onLanguageChange, isLanguageLocked = false, isAnonymous, onToggleAnonymous,
  isAutoSaving = false, lastAutoSaveAt = null, autoSaveFailed = false, isFitting = false,
  letterSaveLabel, onRetrySave, onUndo, canUndo,
}: Props) {
  const isLetter = activeDocument === 'letter';
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (menu.current) menu.current.open = false; }, [activeDocument]);
  const autoSaveLabel = isLetter ? letterSaveLabel : isFitting ? 'Mise en page du CV…' : isAutoSaving ? 'Enregistrement…'
    : autoSaveFailed ? 'Modifications non enregistrées' : lastAutoSaveAt
    ? `Enregistré à ${lastAutoSaveAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Enregistrement automatique';
  const iconButton = 'w-8 h-8 shrink-0 inline-flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600';
  return <header aria-label="Barre de l’éditeur" className="shrink-0 bg-white border-b border-gray-200 z-[60]">
    <div className="h-14 flex items-center justify-between px-3 sm:px-4 gap-2">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <Link to="/dashboard" aria-label="Tableau de bord" title="Tableau de bord" className="w-8 sm:w-28 shrink-0 flex items-center rounded focus-visible:outline-2 focus-visible:outline-blue-600">
          <Logo size="sm" showText={false} /><span className="hidden sm:inline ml-2 text-sm font-semibold">Calibre</span>
        </Link>
        <nav aria-label="Documents de la candidature" className="flex items-center gap-1 text-sm shrink-0">
          <button onClick={onOpenCV} aria-current={!isLetter ? 'page' : undefined} className={cn('w-11 h-9 rounded focus-visible:outline-2 focus-visible:outline-blue-600', !isLetter ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100')}>CV</button>
          <button onClick={onOpenCoverLetter} disabled={!canOpenLetter} aria-label="Lettre de motivation" aria-current={isLetter ? 'page' : undefined} className={cn('w-16 h-9 rounded disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600', isLetter ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100')}>Lettre</button>
        </nav>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onSave} disabled={isSaving || !hasCvData}
          aria-label={isLetter ? 'Copier la lettre' : 'Sauvegarder une version'}
          title={isLetter ? 'Copier la lettre complète' : 'Ajouter une copie du CV dans Mes CV'}
          className="w-9 lg:w-44 h-9 flex items-center justify-center gap-2 text-xs text-gray-600 rounded hover:bg-gray-100 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : isLetter ? <Copy className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span className="hidden lg:inline">{isLetter ? 'Copier la lettre' : 'Sauvegarder une version'}</span>
        </button>
        <details ref={menu} className="relative" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
          <summary role="button" aria-label="Exporter" className="list-none cursor-pointer w-28 h-9 bg-blue-600 text-white rounded flex items-center justify-center gap-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}<span>Exporter</span>
          </summary>
          <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded shadow-sm p-1 z-[60] flex flex-col text-xs" onClick={event => { if ((event.target as HTMLElement).closest('button') && menu.current) menu.current.open = false; }}>
            <button className="p-3 text-left hover:bg-gray-100 rounded" disabled={!hasCvData || isExporting} onClick={onExport}>Exporter en PDF</button>
            <button className="p-3 text-left hover:bg-gray-100 rounded" disabled={!hasCvData || isExportingDocx} onClick={onExportDocx}>Télécharger en Word (.docx)</button>
            <button className="p-3 text-left hover:bg-gray-100 rounded" disabled={!hasCvData} onClick={isLetter ? onExportText : onPreviewPDF}>{isLetter ? 'Exporter en texte (.txt)' : 'Imprimer / prévisualiser'}</button>
          </div>
        </details>
      </div>
    </div>
    <div className="h-10 px-3 sm:px-4 border-t border-gray-100 flex items-center gap-2">
      <button onClick={onToggleSidebar} className={iconButton} aria-label={isSidebarOpen ? 'Fermer le panneau latéral' : 'Ouvrir le panneau latéral'} aria-expanded={isSidebarOpen}><LayoutIcon className="w-4 h-4 text-gray-600" /></button>
      <button onClick={onUndo} disabled={!canUndo} className={iconButton} title="Annuler la dernière modification (Ctrl+Z)" aria-label="Annuler la dernière modification"><Undo2 className="w-4 h-4 text-gray-600" /></button>
      {!isLetter ? <>
        <div className="hidden xl:flex items-center gap-1">
          <button onClick={onZoomOut} className={iconButton} aria-label="Zoom arrière"><Minus className="w-3 h-3" /></button>
          <span className="text-xs w-9 text-center">{zoom}%</span>
          <button onClick={onZoomIn} className={iconButton} aria-label="Zoom avant"><Plus className="w-3 h-3" /></button>
          <button onClick={onToggleAutoZoom} className={cn(iconButton, isAutoZoom && 'bg-blue-50 text-blue-700')} aria-label="Ajuster automatiquement à la fenêtre" aria-pressed={isAutoZoom}><Maximize2 className="w-3 h-3" /></button>
        </div>
        <LanguageSelector value={currentLanguage} onChange={onLanguageChange} disabled={isLanguageLocked} />
        <button onClick={onToggleAnonymous} className={cn(iconButton, isAnonymous && 'bg-orange-100 text-orange-700')} title={isAnonymous ? 'Réafficher vos coordonnées' : 'Masquer nom et coordonnées'} aria-label="Mode anonyme" aria-pressed={isAnonymous}>{isAnonymous ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
      </> : <span className="text-xs text-gray-600">Lettre en {letterLanguage === 'en' ? 'anglais' : 'français'}</span>}
      <span role="status" aria-live="polite" title={autoSaveLabel} className="ml-auto min-w-0 truncate text-[11px] text-gray-500">{autoSaveLabel}</span>
      {isLetter && autoSaveFailed && <button onClick={onRetrySave} className="text-xs text-blue-700 underline shrink-0">Réessayer</button>}
    </div>
  </header>;
}
