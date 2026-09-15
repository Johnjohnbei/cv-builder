import { FileText, LayoutDashboard, LogOut, Settings, User } from 'lucide-react';
import { cn } from '@/src/shared/lib/cn';
import { Logo } from '@/src/shared/ui/Logo';
import { Button } from '@/src/shared/ui/Button';

export type DashboardView = 'console' | 'cvs';

interface Props {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  isAdmin: boolean;
  onOpenAdmin: () => void;
  isSignedIn: boolean;
  isGuest: boolean;
  fullName?: string | null;
  email?: string;
  onLeave: () => void;
}

const NAV_CLASS = "w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors";

/** The dashboard's side navigation, account and sign-out. Extracted from DashboardPage, over its size limit. */
export function DashboardSidebar({ activeView, onViewChange, isAdmin, onOpenAdmin, isSignedIn, isGuest, fullName, email, onLeave }: Props) {
  return (
    <aside className="stitch-sidebar dashboard-sidebar flex-col w-[320px] shrink-0">
      <div className="stitch-header">
        <Logo size="sm" />
      </div>

      <nav className="flex-1 p-2 space-y-1">
        <button
          onClick={() => onViewChange('console')}
          className={cn(NAV_CLASS, activeView === 'console' ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100")}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Optimiser</span>
        </button>
        <button
          onClick={() => onViewChange('cvs')}
          className={cn(NAV_CLASS, activeView === 'cvs' ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100")}
        >
          <FileText className="w-4 h-4" />
          <span>Mes CV</span>
        </button>

        {isAdmin && (
          <button
            onClick={onOpenAdmin}
            className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Admin</span>
          </button>
        )}
      </nav>

      <div className="p-4 border-t border-[#DADCE0] space-y-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-gray-600" />
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold truncate">{fullName || (isGuest ? 'Invité' : 'Utilisateur')}</p>
            <p className="text-[11px] text-gray-500 truncate">{email || (isGuest ? 'Mode local' : '')}</p>
          </div>
        </div>
        {/* The dashboard no longer sits inside Layout, whose header held the only sign-out */}
        <Button variant="ghost" size="sm" mono={false} fullWidth icon={<LogOut className="w-3.5 h-3.5" />} onClick={onLeave}>
          {isSignedIn ? 'Se déconnecter' : 'Quitter le mode invité'}
        </Button>
      </div>
    </aside>
  );
}
