import { Select } from '../../../../shared/ui/Select';
import type { Version } from '../../lib/cv-versions';

interface Props {
  id: string;
  /** What the choice is about, read by a screen reader: "Version du résumé" */
  label: string;
  version: Version;
  /** The user typed in this text once: their version stays one of the choices */
  hasOwnVersion: boolean;
  onChoose: (version: Version) => void;
}

/**
 * The choice between the text adapted to the offer, the user's imported one
 * and, once they typed in it, their own, made in the editor without any AI
 * call (arbitrage of 2026-10-07). Picking one never loses another.
 */
export function VersionSelect({ id, label, version, hasOwnVersion, onChoose }: Props) {
  return (
    <Select
      id={id}
      label={label}
      inputSize="sm"
      mono={false}
      value={version}
      onChange={(e) => onChoose(e.target.value as Version)}
    >
      <option value="adapted">Adaptée à l'offre</option>
      <option value="original">Mon texte d'origine</option>
      {(hasOwnVersion || version === 'edited') && <option value="edited">Ma version modifiée</option>}
    </Select>
  );
}
