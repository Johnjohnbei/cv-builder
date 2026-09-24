import { Calendar, ExternalLink, FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/src/shared/ui/Button';
import { templateName } from '@/src/features/editor/lib/pagination/template-layouts';

/**
 * Saved CV list entry — minimal UI-facing shape. Intentionally narrow: only the
 * fields the dashboard reads. Covers both Convex Doc<"cvs"> (authenticated) and
 * localStorage entries (guest mode) via structural compatibility.
 */
export interface SavedCVEntry {
  _id: string;
  createdAt: string | number;
  personal_info: { name: string; email: string; title?: string };
  design?: { template?: string };
  /** The offer the version was saved with; absent on versions saved before it was kept */
  jobDescription?: string;
}

interface Props {
  savedCVs: SavedCVEntry[];
  onNewCV: () => void;
  onOpen: (cv: SavedCVEntry) => void;
  onRequestDelete: (id: string) => void;
}

/** The "Mes CV" view of the dashboard. Extracted from DashboardPage, over its size limit. */
export function SavedCVsView({ savedCVs, onNewCV, onOpen, onRequestDelete }: Props) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Mes CV Sauvegardés</h2>
          <p className="text-sm text-gray-500">Gérez et éditez vos différentes versions de CV.</p>
        </div>
        <Button mono={false} icon={<Plus className="w-4 h-4" />} onClick={onNewCV}>
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
                    onClick={() => onRequestDelete(cv._id)}
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
                  onClick={() => onOpen(cv)}
                >
                  Ouvrir dans l'éditeur
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
