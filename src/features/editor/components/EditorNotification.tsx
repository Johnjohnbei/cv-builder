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
        "fixed top-6 right-6 z-[300] max-w-sm px-5 py-3 rounded-xl shadow-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300",
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
