import { Layout as LayoutIcon } from 'lucide-react';

const TEMPLATE_NAMES: Record<string, string> = {
  TEMPLATE_A: 'Classic',
  TEMPLATE_B: 'Modern',
  TEMPLATE_C: 'Minimal',
  TEMPLATE_D: 'Creative',
  TEMPLATE_E: 'Elegant',
  TEMPLATE_F: 'Sidebar',
};

interface Props {
  pendingTemplate: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TemplateConfirmModal({ pendingTemplate, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4 text-blue-600">
          <LayoutIcon className="w-6 h-6" />
          <h3 className="text-lg font-bold">Changer de modèle ?</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          Vous êtes sur le point de passer au modèle{' '}
          <span className="font-bold text-gray-900">
            {pendingTemplate ? TEMPLATE_NAMES[pendingTemplate] || pendingTemplate : ''}
          </span>
          . Votre contenu sera conservé, mais certains réglages de design seront automatiquement ajustés.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
