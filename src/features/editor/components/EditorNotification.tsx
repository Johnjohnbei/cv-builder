import { Zap, X } from 'lucide-react';
import { cn } from '@/src/shared/lib/cn';

interface Props {
  message: string;
  type: 'success' | 'error';
}

export function EditorNotification({ message, type }: Props) {
  return (
    <div className={cn(
      "fixed top-6 right-6 z-[300] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300",
      type === 'success' ? "bg-green-600 text-white" : "bg-red-600 text-white"
    )}>
      {type === 'success' ? <Zap className="w-4 h-4" /> : <X className="w-4 h-4" />}
      <span className="text-xs font-bold stitch-mono uppercase tracking-widest">{message}</span>
    </div>
  );
}
