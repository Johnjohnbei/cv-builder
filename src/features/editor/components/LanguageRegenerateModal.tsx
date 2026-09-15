import { Languages, Loader2 } from 'lucide-react';
import { Button } from '@/src/shared/ui/Button';
import { Dialog } from '@/src/shared/ui/Dialog';

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
    <Dialog
      open
      onClose={onCancel}
      dismissible={!isRegenerating}
      title="Changer la langue du CV ?"
      icon={<Languages className="w-6 h-6 text-blue-600" />}
    >
      <p className="text-sm text-gray-600 mb-2 leading-relaxed">
        Votre CV est actuellement rédigé en{' '}
        <span className="font-bold text-gray-900">{LANG_LABEL[fromLang]}</span>.
        Voulez-vous le traduire en{' '}
        <span className="font-bold text-gray-900">{LANG_LABEL[toLang]}</span> ?
      </p>
      <p className="text-xs text-gray-500 mb-6 leading-relaxed">
        La traduction conserve <strong>exactement la même structure</strong> : même nombre de bullets,
        mêmes KPIs, même ordre des expériences. Seuls les textes sont traduits.
        <br /><br />
        <strong>Les deux versions sont conservées</strong> : la prochaine bascule sera instantanée,
        sans nouvel appel IA.
        <br />
        Vous pouvez aussi ne changer que les libellés (Experience / Expérience…) sans toucher au contenu.
      </p>
      <div className="flex flex-col gap-2">
        <Button
          mono={false}
          fullWidth
          disabled={isRegenerating}
          icon={isRegenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
          onClick={onConfirm}
        >
          {isRegenerating ? 'Traduction en cours…' : `Traduire le contenu en ${LANG_LABEL[toLang]}`}
        </Button>
        <Button variant="secondary" mono={false} fullWidth disabled={isRegenerating} onClick={onSwitchOnly}>
          Changer juste les libellés
        </Button>
        <Button variant="ghost" mono={false} fullWidth disabled={isRegenerating} onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </Dialog>
  );
}
