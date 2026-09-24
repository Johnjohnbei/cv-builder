import { memo, useMemo, useState } from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/src/shared/ui/Button';
import { Select } from '@/src/shared/ui/Select';
import type { CVData, PersonalInfo } from '@/src/shared/types';
import { applyVariantToPersonalInfo, getPortfolioVariants, rankPortfolioVariants } from '../lib/portfolio-variants';

interface Props {
  jobDescription: string;
  personalInfo: PersonalInfo | undefined;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  notify: (n: { message: string; type: 'success' | 'error' }) => void;
}

/**
 * Which version of the candidate's portfolio the CV links, chosen against the
 * offer.
 *
 * Lives in the ATS tab because that is where the editor lands the moment an
 * offer arrives: tucked in the Contenu tab, the suggestion was never seen.
 * Suggests, never applies on its own: every configured version is listed, the
 * best match preselected. Renders nothing without VITE_PORTFOLIO_VARIANTS.
 */
export const PortfolioSuggestion = memo(function PortfolioSuggestion({
  jobDescription, personalInfo, setCvData, notify,
}: Props) {
  const ranked = useMemo(
    () => rankPortfolioVariants(getPortfolioVariants(), jobDescription),
    [jobDescription],
  );
  const [chosenId, setChosenId] = useState<string | null>(null);

  if (ranked.length === 0 || !personalInfo) return null;

  const best = ranked[0].hits > 0 ? ranked[0] : null;
  const onCv = ranked.find(m => m.variant.url === personalInfo.portfolio_url)?.variant;
  const selected = ranked.find(m => m.variant.id === chosenId)?.variant
    ?? best?.variant ?? onCv ?? ranked[0].variant;
  const hasLink = Boolean(personalInfo.portfolio_url?.trim());
  const alreadyOnCv = onCv?.id === selected.id;

  const apply = () => {
    setCvData(prev => prev ? { ...prev, personal_info: applyVariantToPersonalInfo(prev.personal_info, selected) } : null);
    notify({ message: `Lien « ${selected.label} » ajouté au CV`, type: 'success' });
  };

  const remove = () => {
    setCvData(prev => prev
      ? { ...prev, personal_info: { ...prev.personal_info, portfolio_url: '', portfolio_label: '', portfolio_anon_url: '' } }
      : null);
  };

  return (
    <section className="stitch-panel p-4 space-y-3" aria-labelledby="portfolio-suggestion-title">
      <div className="flex items-center gap-2 text-blue-600">
        <Globe className="w-4 h-4" />
        <h2 id="portfolio-suggestion-title" className="text-[11px] font-bold uppercase tracking-widest">Portfolio</h2>
      </div>

      <p className="text-[11px] text-gray-600">
        {best ? (
          <>
            Suggéré pour cette offre : <strong className="text-gray-900">{best.variant.label}</strong>
            {' '}({best.hits} terme{best.hits > 1 ? 's' : ''} en commun)
          </>
        ) : jobDescription.trim()
          ? "Aucune version ne ressort de l'offre : choisissez celle à mettre en avant."
          : 'Importez une offre pour obtenir une suggestion.'}
      </p>

      <Select
        label="Version à lier"
        inputSize="sm"
        mono={false}
        value={selected.id}
        onChange={(e) => setChosenId(e.target.value)}
        options={ranked.map(m => ({
          value: m.variant.id,
          label: m.hits > 0 ? `${m.variant.label} (${m.hits})` : m.variant.label,
        }))}
      />

      {hasLink && (
        <p className="text-[11px] text-gray-600">
          Sur le CV : {onCv ? onCv.label : 'un lien saisi à la main'}
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="primary" size="xs" className="flex-1 text-[11px]" disabled={alreadyOnCv} onClick={apply}>
          {alreadyOnCv ? 'Déjà sur le CV' : hasLink ? 'Remplacer sur le CV' : 'Ajouter au CV'}
        </Button>
        {hasLink && (
          <Button variant="ghost" size="xs" className="text-[11px]" onClick={remove}>
            Retirer
          </Button>
        )}
      </div>
    </section>
  );
});
