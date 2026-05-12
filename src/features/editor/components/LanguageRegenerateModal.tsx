import { Languages, Loader2 } from 'lucide-react';

interface Props {
  fromLang: 'fr' | 'en';
  toLang: 'fr' | 'en';
  isRegenerating: boolean;
  onConfirm: () => void;
  onSwitchOnly: () => void;
  onCancel: () => void;
}

const LANG_LABEL: Record<'fr' | 'en', string> = {
  fr: 'français',
  en: 'anglais',
};

export function LanguageRegenerateModal({
  fromLang, toLang, isRegenerating, onConfirm, onSwitchOnly, onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4 text-blue-600">
          <Languages className="w-6 h-6" />
          <h3 className="text-lg font-bold">Changer la langue du CV ?</h3>
        </div>
        <p className="text-sm text-gray-600 mb-2 leading-relaxed">
          Votre CV est actuellement rédigé en{' '}
          <span className="font-bold text-gray-900">{LANG_LABEL[fromLang]}</span>.
          Voulez-vous le traduire en{' '}
          <span className="font-bold text-gray-900">{LANG_LABEL[toLang]}</span> ?
        </p>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">
          La traduction conserve <strong>exactement la même structure</strong> : même nombre de bullets,
          mêmes KPIs, même ordre des expériences. Seuls les textes sont traduits.
          Vous pouvez aussi ne changer que les libellés (Experience / Expérience…) sans toucher au contenu.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            disabled={isRegenerating}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Traduction en cours…
              </>
            ) : (
              <>Traduire le contenu en {LANG_LABEL[toLang]}</>
            )}
          </button>
          <button
            onClick={onSwitchOnly}
            disabled={isRegenerating}
            className="w-full px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Changer juste les libellés
          </button>
          <button
            onClick={onCancel}
            disabled={isRegenerating}
            className="w-full px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
