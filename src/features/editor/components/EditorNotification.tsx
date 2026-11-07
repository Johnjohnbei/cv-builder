import { Zap, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/src/shared/lib/cn';

interface Props {
  message: string;
  type: 'success' | 'error';
  /** Dismiss handler: renders a close button so errors can be read then closed */
  onClose?: () => void;
}

export function EditorNotification({ message, type, onClose }: Props) {
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={cn(
        // max-w-sm vaut 384px : posée à droite seulement, la boîte couvrait tout
        // l'en-tête de l'éditeur sur un écran de 375px, bouton de panneau compris
        "fixed top-4 right-4 left-4 sm:left-auto sm:top-6 sm:right-6 sm:max-w-sm z-[300] px-5 py-3 rounded-xl shadow-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300",
        type === 'success' ? "bg-green-600 text-white" : "bg-red-600 text-white"
      )}
    >
      {type === 'success' ? <Zap className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
      <span className="text-sm leading-snug">{message}</span>
      {onClose && (
        <button onClick={onClose} className="p-0.5 -mr-1 hover:bg-white/20 rounded shrink-0" aria-label="Fermer la notification">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
