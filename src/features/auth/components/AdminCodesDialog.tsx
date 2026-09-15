import { useState } from 'react';
import { Loader2, Settings } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/src/shared/ui/Button';
import { Dialog } from '@/src/shared/ui/Dialog';
import { Input } from '@/src/shared/ui/Input';
import { getUserErrorMessage } from '@/src/shared/lib/convexError';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Admin: generate access codes, list them and the access requests. Extracted from DashboardPage. */
export function AdminCodesDialog({ open, onClose }: Props) {
  const codes = useQuery(api.accessCodes.list, open ? undefined : 'skip');
  const requests = useQuery(api.accessCodes.listRequests, open ? undefined : 'skip');
  const generateCode = useMutation(api.accessCodes.generate);
  const [days, setDays] = useState(30);
  const [uses, setUses] = useState(50);
  const [label, setLabel] = useState('');
  const [generated, setGenerated] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    // Guarded: a failure used to go unhandled, and a double click created two codes
    if (isGenerating) return;
    setIsGenerating(true);
    setError('');
    try {
      const result = await generateCode({ maxUses: uses, durationDays: days, label: label || undefined });
      setGenerated(result.code);
    } catch (e) {
      setError(getUserErrorMessage(e, 'Génération impossible. Réessayez.'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Admin : codes d'accès"
      icon={<Settings className="w-5 h-5 text-amber-600" />}
      className="max-w-lg"
    >
      <div className="max-h-[70vh] overflow-y-auto space-y-4">
        <section className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-700">Générer un code</h3>
          <div className="grid grid-cols-3 gap-2">
            <Input id="admin-code-days" label="Durée (jours)" type="number" min={1} value={days} onChange={e => setDays(+e.target.value)} />
            <Input id="admin-code-uses" label="Utilisations" type="number" min={1} value={uses} onChange={e => setUses(+e.target.value)} />
            <Input id="admin-code-label" label="Label" value={label} onChange={e => setLabel(e.target.value)} placeholder="beta" />
          </div>
          <Button
            fullWidth
            mono={false}
            disabled={isGenerating}
            icon={isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
            onClick={generate}
          >
            Générer
          </Button>
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          {generated && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-xs text-green-700 mb-1">Code généré :</p>
              <p className="text-lg font-bold font-mono text-green-800 select-all">{generated}</p>
            </div>
          )}
        </section>

        <section className="border rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-2">Codes ({codes?.length || 0})</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {codes?.map((c) => {
              const expired = new Date(c.expiresAt) < new Date();
              return (
                <div key={c._id} className="flex justify-between items-center text-xs bg-gray-50 rounded px-3 py-2">
                  <span className="font-mono font-bold">{c.code}</span>
                  <span className="text-gray-600">{c.usedCount}/{c.maxUses} · {c.label || 'sans label'}</span>
                  <span className={expired ? 'text-red-600' : 'text-green-700'}>
                    {expired ? 'Expiré' : `Jusqu'au ${new Date(c.expiresAt).toLocaleDateString('fr-FR')}`}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-2">Demandes d'accès ({requests?.length || 0})</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {requests?.map((r) => (
              <div key={r._id} className="flex justify-between items-center text-xs bg-gray-50 rounded px-3 py-2">
                <span className="font-medium">{r.email}</span>
                <span className="text-gray-600">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</span>
              </div>
            ))}
            {(!requests || requests.length === 0) && <p className="text-xs text-gray-600">Aucune demande</p>}
          </div>
        </section>

        <Button variant="secondary" mono={false} fullWidth onClick={onClose}>Fermer</Button>
      </div>
    </Dialog>
  );
}
