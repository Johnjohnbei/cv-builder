import { Layout as LayoutIcon, Save, Download, Loader2, Minus, Plus, Maximize2, EyeOff, Eye, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/src/shared/lib/cn';
import { LanguageSelector } from '@/src/shared/ui/LanguageSelector';

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
  /**
   * The fit-to-pages pass is running. Said here because it starts on its own
   * when the editor opens and takes up to ten seconds: its only indicator was
   * in the Contenu tab, while the editor had just switched to the ATS tab, so
   * the CV condensed under the user's eyes with nothing to explain it.
   */
  isFitting?: boolean;
  /** Undoes the last edit made in the preview (Ctrl+Z does the same) */
  onUndo: () => void;
  /** False when nothing was edited in the preview yet */
  canUndo: boolean;
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
  isFitting = false,
  onUndo, canUndo,
}: Props) {
  // The fit comes first: it suspends the auto-save, so the save state behind it
  // is the one from before and says nothing about what is happening now
  const autoSaveLabel = isFitting
    ? 'Mise en page du CV…'
    : isAutoSaving
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
        {/* From xl: the editor keeps a 320px sidebar from 768px up, so the
            header draws in what is left. Measured 2026-11-07: with the crumb and
            the zoom block, it needs 791px, which 1024 does not give (704). The
            sidebar carries the same link back to the dashboard. */}
        <div className="hidden xl:flex items-center space-x-4 text-sm text-gray-500">
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

      {/* Measured 2026-11-07: shown from sm, this whole group pushed the export
          button 95px past the right edge at 768px, where the container clipped
          it. Zoom goes first (the auto-zoom already fits the page by itself);
          the language and the anonymous toggle stay, because the editor offers
          them nowhere else. */}
      <div className="hidden sm:flex items-center bg-white border border-[#DADCE0] rounded px-3 py-1 gap-4 shadow-sm">
        <div className="hidden xl:flex items-center gap-2 border-r border-gray-100 pr-3">
          <button onClick={onZoomOut} className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Zoom arrière" aria-label="Zoom arrière">
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-[10px] stitch-mono font-bold w-8 text-center">{zoom}%</span>
          <button onClick={onZoomIn} className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Zoom avant" aria-label="Zoom avant">
            <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={onToggleAutoZoom}
            className={cn(
              "ml-1 p-1.5 rounded transition-colors",
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
              "flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold transition-colors",
              isAnonymous ? "bg-orange-100 text-orange-700" : "hover:bg-gray-100 text-gray-500"
            )}
            title={isAnonymous ? "Réafficher vos coordonnées" : "Masquer nom et coordonnées (CV anonyme)"}
            // Le nom d'un bouton bascule ne change pas avec son état : l'état
            // est dans aria-pressed, et le titre dit ce que le clic fera
            aria-label="Mode anonyme"
            aria-pressed={isAnonymous}
          >
            {isAnonymous ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {/* The word costs 55px of a 448px header at tablet width; the icon
                and the accessible name carry it there */}
            <span className="hidden lg:inline">Anonyme</span>
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
          title="Annuler la dernière modification faite dans l'aperçu (Ctrl+Z)"
          aria-label="Annuler la dernière modification"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onSave}
          disabled={isSaving || !hasCvData}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          title="Ajouter une copie de ce CV dans Mes CV (vos modifications sont déjà enregistrées automatiquement)"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span className="text-[11px] font-bold hidden xl:inline">Sauvegarder une version</span>
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
