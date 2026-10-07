import { Select } from '../../../../shared/ui/Select';
import type { Version } from '../../lib/cv-versions';

interface Props {
  id: string;
  /** What the choice is about, read by a screen reader: "Version du résumé" */
  label: string;
  version: Version;
  onChoose: (version: Exclude<Version, 'edited'>) => void;
}

/**
 * The choice between the text adapted to the offer and the user's own, made in
 * the editor without any AI call (arbitrage of 2026-10-07). A text the user
 * typed in is neither: it shows as edited until they pick one again.
 */
export function VersionSelect({ id, label, version, onChoose }: Props) {
  return (
    <Select
      id={id}
      label={label}
      inputSize="sm"
      mono={false}
      value={version}
      onChange={(e) => {
        if (e.target.value !== 'edited') onChoose(e.target.value as Exclude<Version, 'edited'>);
      }}
    >
      <option value="adapted">Adaptée à l'offre</option>
      <option value="original">Mon texte d'origine</option>
      {version === 'edited' && <option value="edited" disabled>Modifiée à la main</option>}
    </Select>
  );
}
