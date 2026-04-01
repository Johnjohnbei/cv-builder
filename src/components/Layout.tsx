import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, LogOut, User } from 'lucide-react';
import { useClerk, useAuth } from '@clerk/clerk-react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">VibeCV</span>
          </Link>

          <nav className="flex items-center space-x-6">
            {isSignedIn ? (
              <>
                <Link to="/dashboard" className="text-sm font-medium text-gray-600 hover:text-blue-600 flex items-center space-x-1">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Tableau de bord</span>
                </Link>
                <button 
                  onClick={handleLogout}
                  className="text-sm font-medium text-gray-600 hover:text-red-600 flex items-center space-x-1"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Déconnexion</span>
                </button>
              </>
            ) : (
              <Link to="/auth" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                Connexion
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-500">© 2026 VibeCV Academy - L'IA au service de votre carrière.</p>
        </div>
      </footer>
    </div>
  );
}
