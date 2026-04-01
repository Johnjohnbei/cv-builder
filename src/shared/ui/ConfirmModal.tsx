interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'info';
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', onConfirm, onCancel, variant = 'info' }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-lg max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-gray-600">{title}</h3>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-6">{message}</p>
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2 border border-gray-200 text-xs font-bold font-mono hover:bg-gray-50 transition-colors rounded"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-2 text-white text-xs font-bold font-mono transition-colors rounded ${
                variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
