import { Layout as LayoutIcon, Save, Download, Loader2, Minus, Plus, Maximize2, EyeOff, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/src/shared/lib/cn';
import { LanguageSelector } from './LanguageSelector';

interface Props {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  zoom: number;
  isAutoZoom: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleAutoZoom: () => void;
  onSave: () => void;
  onExport: () => void;
  isSaving: boolean;
  isExporting: boolean;
  hasCvData: boolean;
  currentLanguage: 'fr' | 'en';
  onLanguageChange: (lang: 'fr' | 'en') => void;
  /** Locks the language switch while an AI call rewrites the CV: its answer would undo the switch */
  isLanguageLocked?: boolean;
  isAnonymous: boolean;
  onToggleAnonymous: () => void;
  /** Auto-save feedback: true while a debounced save runs */
  isAutoSaving?: boolean;
  /** Timestamp of the last successful auto-save (null before the first one) */
  lastAutoSaveAt?: Date | null;
  /** The last auto-save failed: never let an older "Enregistré à" stand for it */
  autoSaveFailed?: boolean;
}

export function EditorHeader({
  isSidebarOpen, onToggleSidebar,
  zoom, isAutoZoom, onZoomIn, onZoomOut, onToggleAutoZoom,
  onSave, onExport, isSaving, isExporting, hasCvData,
  currentLanguage, onLanguageChange, isLanguageLocked = false,
  isAnonymous, onToggleAnonymous,
  isAutoSaving = false,
  lastAutoSaveAt = null,
  autoSaveFailed = false,
}: Props) {
  const autoSaveLabel = isAutoSaving
    ? 'Enregistrement...'
    : autoSaveFailed
      ? 'Modifications non enregistrées'
      : lastAutoSaveAt
      ? `Enregistré à ${lastAutoSaveAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      : null;

  return (
    <header className="stitch-header justify-between shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className={cn(
            "p-2 hover:bg-gray-100 rounded-lg transition-colors",
            isSidebarOpen ? "md:hidden" : ""
          )}
          aria-label={isSidebarOpen ? "Fermer le panneau latéral" : "Ouvrir le panneau latéral"}
        >
          <LayoutIcon className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <Link to="/dashboard" className="hover:text-gray-900 transition-colors">Tableau de bord</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-medium">Éditeur</span>
        </div>
        {autoSaveLabel && (
          <span className="hidden md:inline text-[11px] text-gray-500" aria-live="polite">
            {autoSaveLabel}
          </span>
        )}
      </div>

      <div className="hidden sm:flex items-center bg-white border border-[#DADCE0] rounded-full px-3 py-1 gap-4 shadow-sm">
        <div className="flex items-center gap-2 border-r border-gray-100 pr-3">
          <button onClick={onZoomOut} className="p-1 hover:bg-gray-100 rounded transition-colors" title="Zoom arrière">
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-[10px] stitch-mono font-bold w-8 text-center">{zoom}%</span>
          <button onClick={onZoomIn} className="p-1 hover:bg-gray-100 rounded transition-colors" title="Zoom avant">
            <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={onToggleAutoZoom}
            className={cn(
              "ml-1 p-1 rounded transition-colors",
              isAutoZoom ? "bg-blue-50 text-blue-600" : "hover:bg-gray-100 text-gray-500"
            )}
            title={isAutoZoom ? "Zoom automatique actif : cliquez pour le désactiver" : "Ajuster automatiquement à la fenêtre"}
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
        <div className="flex items-center">
          <LanguageSelector value={currentLanguage} onChange={onLanguageChange} disabled={isLanguageLocked} />
        </div>
        <div className="border-l border-gray-100 pl-3 flex items-center gap-2">
          <button
            onClick={onToggleAnonymous}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors",
              isAnonymous ? "bg-orange-100 text-orange-700" : "hover:bg-gray-100 text-gray-500"
            )}
            title={isAnonymous ? "Réafficher vos coordonnées" : "Masquer nom et coordonnées (CV anonyme)"}
          >
            {isAnonymous ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            Anonyme
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onSave}
          disabled={isSaving || !hasCvData}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          title="Ajouter une copie de ce CV dans Mes CV (vos modifications sont déjà enregistrées automatiquement)"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span className="text-[11px] font-bold hidden sm:inline">Sauvegarder une version</span>
        </button>
        <button
          onClick={onExport}
          disabled={isExporting || !hasCvData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
          title="Télécharger le CV en PDF"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="text-[11px] font-bold hidden sm:inline">Exporter</span>
        </button>
      </div>
    </header>
  );
}
