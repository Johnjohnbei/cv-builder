import { Layout as LayoutIcon } from 'lucide-react';
import { Button } from '@/src/shared/ui/Button';
import { Dialog } from '@/src/shared/ui/Dialog';

const TEMPLATE_NAMES: Record<string, string> = {
  TEMPLATE_A: 'Classic',
  TEMPLATE_B: 'Modern',
  TEMPLATE_C: 'Minimal',
  TEMPLATE_E: 'Elegant',
};

interface Props {
  pendingTemplate: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TemplateConfirmModal({ pendingTemplate, onConfirm, onCancel }: Props) {
  return (
    <Dialog
      open
      onClose={onCancel}
      title="Changer de modèle ?"
      icon={<LayoutIcon className="w-6 h-6 text-blue-600" />}
    >
      <p className="text-sm text-gray-600 mb-6 leading-relaxed">
        Vous êtes sur le point de passer au modèle{' '}
        <span className="font-bold text-gray-900">
          {pendingTemplate ? TEMPLATE_NAMES[pendingTemplate] || pendingTemplate : ''}
        </span>
        . Votre contenu sera conservé, mais la police sera ajustée au modèle.
      </p>
      <div className="flex gap-3">
        <Button variant="secondary" mono={false} className="flex-1" onClick={onCancel}>Annuler</Button>
        <Button mono={false} className="flex-1" onClick={onConfirm}>Confirmer</Button>
      </div>
    </Dialog>
  );
}
