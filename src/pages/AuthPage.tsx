import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignIn, useAuth } from '@clerk/clerk-react';
import { Lock, User, Chrome, FileText } from 'lucide-react';

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { signIn, isLoaded } = useSignIn();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      navigate('/dashboard');
    }
  }, [isSignedIn, navigate]);

  const handleGoogleLogin = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err) {
      console.error('Error logging in:', err);
      setError('Erreur lors de la connexion Google. Veuillez réessayer.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <div className="max-w-md w-full border border-[#DADCE0] bg-white rounded shadow-sm">
        <div className="h-9 border-b border-[#DADCE0] bg-[#F8F9FA] flex items-center px-3 font-mono text-[11px] uppercase tracking-wider text-gray-500">
          Connexion
        </div>
        <div className="p-8">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-8 h-8 bg-[#1A73E8] rounded flex items-center justify-center">
              <FileText className="text-white w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight">VibeCV</span>
          </div>

          <h1 className="text-2xl font-bold text-[#202124] mb-2 tracking-tight">
            Bienvenue
          </h1>
          <p className="text-sm text-gray-500 mb-8">
            Connectez-vous pour optimiser vos CV avec l'IA.
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded flex items-center space-x-2">
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-[#1A73E8] text-white px-4 py-3 rounded font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#174EA6] transition-colors flex items-center justify-center space-x-3 disabled:opacity-50"
            >
              <Chrome className="w-4 h-4" />
              <span>{loading ? 'Connexion...' : 'Continuer avec Google'}</span>
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#DADCE0]" />
              </div>
              <div className="relative flex justify-center text-[10px] font-mono">
                <span className="px-2 bg-white text-gray-400 uppercase">ou</span>
              </div>
            </div>

            <button
              onClick={() => {
                sessionStorage.setItem('guest_access', 'true');
                navigate('/dashboard');
              }}
              className="w-full border border-[#DADCE0] bg-white text-gray-700 px-4 py-3 rounded font-mono text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
            >
              <User className="w-4 h-4" />
              <span>Mode invité</span>
            </button>
          </div>
        </div>
        <div className="px-8 py-3 bg-[#F8F9FA] border-t border-[#DADCE0]">
          <p className="font-mono text-[9px] text-gray-400 text-center">
            Données sécurisées · Hébergement Europe
          </p>
        </div>
      </div>
    </div>
  );
}
