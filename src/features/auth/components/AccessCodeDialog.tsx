import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useConvex, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/src/shared/ui/Button';
import { Dialog } from '@/src/shared/ui/Dialog';
import { Input } from '@/src/shared/ui/Input';
import { getUserErrorMessage } from '@/src/shared/lib/convex-error';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with a code the server accepted */
  onGranted: (code: string) => void;
}

/**
 * Asks a guest for an access code before an AI action, or for an email to
 * request one. Extracted from DashboardPage, which had grown past 900 lines.
 */
export function AccessCodeDialog({ open, onClose, onGranted }: Props) {
  const convex = useConvex();
  const requestAccess = useMutation(api.accessCodes.requestAccess);
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [email, setEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  const confirm = async () => {
    const code = codeInput.trim();
    if (!code || isVerifying) return;
    setIsVerifying(true);
    try {
      // Verified BEFORE storing: an invalid code must fail here, in the dialog,
      // not later inside an AI action with a generic error.
      const result = await convex.query(api.accessCodes.verify, { code });
      if (!result.valid) {
        setError(result.reason ?? 'Code invalide ou expiré');
        return;
      }
      setError('');
      setCodeInput('');
      onGranted(code);
    } catch {
      setError('Vérification impossible. Vérifiez votre connexion et réessayez.');
    } finally {
      setIsVerifying(false);
    }
  };

  const sendRequest = async () => {
    if (!email) return;
    try {
      await requestAccess({ email, message: 'Demande depuis Calibre' });
      setRequestSent(true);
    } catch (e) {
      setError(getUserErrorMessage(e, "Erreur lors de l'envoi. Réessayez."));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Accès aux fonctionnalités IA"
      icon={<Sparkles className="w-6 h-6 text-blue-600" />}
    >
      <p className="text-sm text-gray-500 mb-4 leading-relaxed">
        Les fonctions IA sont ouvertes aux comptes connectés. En mode invité, un code d'accès est nécessaire :
        les coûts d'infrastructure de l'IA sont significatifs.
      </p>

      <form
        className="space-y-2 mb-6"
        onSubmit={(e) => { e.preventDefault(); void confirm(); }}
      >
        <Input
          id="access-code"
          label="Code d'accès"
          mono={false}
          value={codeInput}
          onChange={(e) => { setCodeInput(e.target.value); setError(''); }}
          placeholder="Entrez votre code d'accès…"
          autoComplete="off"
          autoFocus
        />
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" mono={false} className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            mono={false}
            className="flex-1"
            disabled={!codeInput.trim() || isVerifying}
            icon={isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
          >
            {isVerifying ? 'Vérification…' : 'Valider'}
          </Button>
        </div>
      </form>

      <div className="border-t border-gray-100 pt-5">
        <p className="text-xs text-gray-600 text-center mb-3">
          Pas de code ? Connectez-vous avec un compte, ou laissez votre email pour recevoir un accès.
        </p>
        {requestSent ? (
          <div role="status" className="text-center py-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-700 font-medium">Demande envoyée</p>
            <p className="text-xs text-green-600 mt-1">Vous recevrez un code par email.</p>
          </div>
        ) : (
          <form className="flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); void sendRequest(); }}>
            <Input
              id="access-request-email"
              label="Votre email"
              type="email"
              mono={false}
              containerClassName="flex-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
            />
            <Button type="submit" variant="secondary" mono={false} disabled={!email}>Envoyer</Button>
          </form>
        )}
      </div>
    </Dialog>
  );
}
