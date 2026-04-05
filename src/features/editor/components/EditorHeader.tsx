import { Layout as LayoutIcon, Save, Download, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/src/shared/lib/cn';

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
}

export function EditorHeader({
  isSidebarOpen, onToggleSidebar,
  zoom, isAutoZoom, onZoomIn, onZoomOut, onToggleAutoZoom,
  onSave, onExport, isSaving, isExporting, hasCvData,
}: Props) {
  return (
    <header className="stitch-header justify-between shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className={cn(
            "p-2 hover:bg-gray-100 rounded-lg transition-colors",
            isSidebarOpen ? "md:hidden" : ""
          )}
          aria-label="Toggle sidebar"
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
          <button onClick={onZoomOut} className="p-1 hover:bg-gray-100 rounded transition-colors" title="Zoom arrière">
            <ChevronDown className="w-3 h-3 rotate-90" />
          </button>
          <span className="text-[10px] stitch-mono font-bold w-8 text-center">{zoom}%</span>
          <button onClick={onZoomIn} className="p-1 hover:bg-gray-100 rounded transition-colors" title="Zoom avant">
            <ChevronUp className="w-3 h-3 rotate-90" />
          </button>
          <button
            onClick={onToggleAutoZoom}
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
          onClick={onSave}
          disabled={isSaving || !hasCvData}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          title="Sauvegarder le brouillon"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span className="text-[10px] stitch-mono font-bold hidden sm:inline">SAVE</span>
        </button>
        <button
          onClick={onExport}
          disabled={isExporting || !hasCvData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
          title="Exporter en PDF"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="text-[10px] stitch-mono font-bold hidden sm:inline">EXPORT</span>
        </button>
      </div>
    </header>
  );
}
