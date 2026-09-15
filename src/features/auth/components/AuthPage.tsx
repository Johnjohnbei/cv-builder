import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSignIn, useAuth } from '@clerk/clerk-react';
import { Lock, User, Globe } from 'lucide-react';
import { Logo } from '@/src/shared/ui/Logo';
import { Button } from '@/src/shared/ui/Button';
import { useDocumentTitle } from '@/src/shared/hooks';
import { readStoredText, writeStoredText } from '@/src/shared/lib/storage';

const GUEST_UNAVAILABLE_MESSAGE =
  "Mode invité indisponible : ce navigateur bloque le stockage des données du site. Autorisez-le, ou connectez-vous.";

export default function AuthPage() {
  useDocumentTitle('Connexion');
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  // Sent here by the home page's guest button when storage is blocked: say why on arrival
  const [error, setError] = useState<string | null>(() =>
    (location.state as { guestUnavailable?: boolean } | null)?.guestUnavailable ? GUEST_UNAVAILABLE_MESSAGE : null,
  );
  // Guest CVs live in localStorage, but the guest flag lives in sessionStorage:
  // returning visitors think their work is gone. Read once on mount.
  const [hasGuestCVs] = useState(
    () => Boolean(readStoredText('guest_last_optimized') || readStoredText('guest_cvs')),
  );
  const navigate = useNavigate();
  const { signIn, isLoaded } = useSignIn();
  const { isSignedIn } = useAuth();

  // Read once, then dropped: left in history.state, the message came back on
  // reload even after the user had unblocked storage. Declared BEFORE the
  // sign-in redirect: effects run in order, and this replace used to overwrite
  // the /dashboard navigation of a user already signed in.
  useEffect(() => {
    if ((location.state as { guestUnavailable?: boolean } | null)?.guestUnavailable) {
      navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: null });
    }
  }, []);

  useEffect(() => {
    // Replace, not push: Back from the dashboard landed on /auth, which pushed /dashboard again
    if (isSignedIn) navigate('/dashboard', { replace: true });
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
          <div className="mb-8">
            <Logo size="md" />
          </div>

          <h1 className="text-2xl font-bold text-[#202124] mb-2 tracking-tight">
            Bienvenue
          </h1>
          <p className="text-sm text-gray-500 mb-8">
            Connectez-vous pour optimiser vos CV avec l'IA.
          </p>

          {error && (
            <div role="alert" className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded flex items-center space-x-2">
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <Button size="lg" fullWidth disabled={loading} icon={<Globe className="w-4 h-4" />} onClick={handleGoogleLogin}>
              {loading ? 'Connexion…' : 'Continuer avec Google'}
            </Button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#DADCE0]" />
              </div>
              <div className="relative flex justify-center text-[11px] font-mono">
                <span className="px-2 bg-white text-gray-600 uppercase">ou</span>
              </div>
            </div>

            <Button
              variant="secondary"
              size="lg"
              fullWidth
              className="text-gray-700"
              icon={<User className="w-4 h-4" />}
              onClick={() => {
                // A raw write threw here and the button did nothing, silently
                if (!writeStoredText('guest_access', 'true', 'session')) {
                  // Cleared first: the same text set again changed nothing in the
                  // DOM, so a repeated failure was not announced to screen readers
                  setError(null);
                  setTimeout(() => setError(GUEST_UNAVAILABLE_MESSAGE), 0);
                  return;
                }
                navigate('/dashboard');
              }}
            >
              Mode invité
            </Button>

            {hasGuestCVs && (
              <p className="text-[11px] text-gray-600 text-center leading-snug">
                Vos CV enregistrés sur cet appareil sont toujours là : repassez en mode invité pour les retrouver.
              </p>
            )}
          </div>
        </div>
        <div className="px-8 py-3 bg-[#F8F9FA] border-t border-[#DADCE0]">
          <p className="font-mono text-[11px] text-gray-600 text-center">
            Données sécurisées · Hébergement Europe
          </p>
        </div>
      </div>
    </div>
  );
}
