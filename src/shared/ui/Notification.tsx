import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn } from '../lib/cn';

interface Props {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export function Notification({ message, type, onClose }: Props) {
  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-50 flex items-center space-x-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-bottom-4 duration-300",
      type === 'success' ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
    )}>
      {type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      <span className="text-xs font-medium">{message}</span>
      <button onClick={onClose} className="p-1 hover:bg-black/5 rounded">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
