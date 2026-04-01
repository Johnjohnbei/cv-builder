import { type ReactNode, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  id: string;
  title: string;
  icon: ReactNode;
  number?: string;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: (id: string) => void;
  children: ReactNode;
}

export function Accordion({ id, title, icon, number, defaultOpen, isOpen: controlledOpen, onToggle, children }: Props) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const handleToggle = () => {
    if (onToggle) onToggle(id);
    else setInternalOpen(prev => !prev);
  };

  return (
    <div className="border border-[--border-color] bg-white rounded overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full h-9 border-b border-[--border-color] bg-[--bg-side] flex items-center justify-between px-3 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[--text-secondary]">
          {icon}
          <span>{number ? `${number}. ` : ''}{title}</span>
        </div>
        {isOpen ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
      </button>
      {isOpen && (
        <div className="p-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
