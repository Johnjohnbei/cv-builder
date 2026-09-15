import { FileText, LayoutDashboard, LogOut } from 'lucide-react';
import { cn } from '@/src/shared/lib/cn';
import type { DashboardView } from './DashboardSidebar';

interface Props {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  isSignedIn: boolean;
  onLeave: () => void;
}

const ITEM_CLASS = "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors min-w-0";

/** The bottom navigation shown on phones, where the sidebar is hidden. Extracted from DashboardPage, over its size limit. */
export function DashboardMobileNav({ activeView, onViewChange, isSignedIn, onLeave }: Props) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#DADCE0] flex items-center justify-around px-2 py-1 safe-area-bottom">
      <button
        onClick={() => onViewChange('console')}
        className={cn(ITEM_CLASS, activeView === 'console' ? "text-blue-600" : "text-gray-500")}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span>Optimiser</span>
      </button>
      <button
        onClick={() => onViewChange('cvs')}
        className={cn(ITEM_CLASS, activeView === 'cvs' ? "text-blue-600" : "text-gray-500")}
      >
        <FileText className="w-5 h-5" />
        <span>CV</span>
      </button>
      {/* The sidebar, and its sign-out, are hidden on phones */}
      <button onClick={onLeave} className={cn(ITEM_CLASS, "text-gray-500")}>
        <LogOut className="w-5 h-5" />
        <span>{isSignedIn ? 'Déconnexion' : 'Quitter'}</span>
      </button>
    </nav>
  );
}
