import { memo } from 'react';
import { Select } from '../../../../shared/ui/Select';
import { Input } from '../../../../shared/ui/Input';
import { Button } from '../../../../shared/ui/Button';
import { Toggle } from '../../../../shared/ui/Toggle';
import type { DesignSettings } from '../../../../shared/types';

type FontFamily = DesignSettings['fontFamily'];

const FONT_OPTIONS: ReadonlyArray<{ id: FontFamily; name: string }> = [
  { id: 'sans', name: 'Inter (Sans)' },
  { id: 'serif', name: 'Georgia (Serif)' },
  { id: 'mono', name: 'JetBrains (Mono)' },
  { id: 'playfair', name: 'Playfair (Display)' }, // anti-vibe-ok: cv document font option
  { id: 'outfit', name: 'Outfit (Modern)' }, // anti-vibe-ok: cv document font option
];

interface ColorTheme { name: string; description: string; p: string; s: string; f: FontFamily; presentation: NonNullable<DesignSettings['presentation']> }
const COLOR_THEMES: ReadonlyArray<ColorTheme> = [
  { name: 'Chronologie', description: 'Parcours rythmé, contacts à droite', p: '#1A73E8', s: '#5F6368', f: 'outfit', presentation: 'timeline' },
  { name: 'Classique', description: 'Georgia, titres soulignés, en-tête regroupé', p: '#202b36', s: '#53606d', f: 'serif', presentation: 'classic' },
  { name: 'Épuré', description: 'Sans frise, titres sobres, accent discret', p: '#25554f', s: '#475b57', f: 'outfit', presentation: 'plain' },
];

/** The colour pairs offered as presets. The names were comments, which no screen reader reads. */
const COLOR_PRESETS = [
  { name: 'Bleu Google', p: '#1A73E8', s: '#5F6368' },
  { name: 'Noir', p: '#000000', s: '#666666' },
  { name: 'Ardoise', p: '#2D3436', s: '#636E72' },
  { name: 'Bleu', p: '#0984E3', s: '#74B9FF' },
  { name: 'Violet', p: '#6C5CE7', s: '#A29BFE' },
  { name: 'Vert', p: '#00B894', s: '#55EFC4' },
  { name: 'Rouge', p: '#D63031', s: '#FF7675' },
] as const;

interface Props {
  designSettings: DesignSettings;
  setDesignSettings: React.Dispatch<React.SetStateAction<DesignSettings>>;
  actualPageCount: number;
}

export const DesignTab = memo(function DesignTab({
  designSettings, setDesignSettings,
  actualPageCount,
}: Props) {
  return (
    <div className="space-y-6">
      <section className="stitch-panel">
        <div className="stitch-panel-header">Présentation du CV</div>
        <div className="p-4 flex flex-col gap-2">
          {COLOR_THEMES.map((theme) => (
            <button
              key={theme.name}
              onClick={() => setDesignSettings(prev => ({
                ...prev,
                primaryColor: theme.p,
                secondaryColor: theme.s,
                fontFamily: theme.f,
                presentation: theme.presentation,
              }))}
              className={`p-2 border rounded text-[11px] stitch-mono transition-colors text-left flex flex-col gap-1 ${(designSettings.presentation ?? 'timeline') === theme.presentation ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
              aria-pressed={(designSettings.presentation ?? 'timeline') === theme.presentation}
            >
              <span className="font-bold">{theme.name}</span>
              <span className="text-gray-600 font-sans">{theme.description}</span>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.p }} />
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.s }} />
              </div>
            </button>
          ))}
        </div>
        <p className="px-4 pb-4 text-xs text-gray-600">Même contenu, une colonne et un texte PDF contrôlé. La mise en page est recalculée pour chaque présentation.</p>
      </section>

      <details className="stitch-panel">
        <summary className="stitch-panel-header cursor-pointer">Couleurs personnalisées</summary>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-[11px] stitch-mono text-gray-500 uppercase block mb-2">Préréglages</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setDesignSettings(prev => ({ ...prev, primaryColor: preset.p, secondaryColor: preset.s }))}
                  className="w-9 h-9 rounded border border-gray-200 flex overflow-hidden"
                  title={preset.name}
                  aria-label={`Couleurs ${preset.name}`}
                  aria-pressed={designSettings.primaryColor === preset.p && designSettings.secondaryColor === preset.s}
                >
                  <div className="flex-1" style={{ backgroundColor: preset.p }} />
                  <div className="flex-1" style={{ backgroundColor: preset.s }} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="primary-color" className="text-[11px] stitch-mono text-gray-500 uppercase block mb-2">Couleur principale</label>
            <div className="flex items-center gap-3">
              <input
                id="primary-color"
                type="color"
                value={designSettings.primaryColor}
                onChange={(e) => setDesignSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                className="w-11 h-11 shrink-0 rounded cursor-pointer border-none p-0"
              />
              <Input
                type="text"
                aria-label="Couleur principale, code hexadécimal"
                className="py-1"
                value={designSettings.primaryColor}
                onChange={(e) => setDesignSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label htmlFor="secondary-color" className="text-[11px] stitch-mono text-gray-500 uppercase block mb-2">Couleur secondaire</label>
            <div className="flex items-center gap-3">
              <input
                id="secondary-color"
                type="color"
                value={designSettings.secondaryColor}
                onChange={(e) => setDesignSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                className="w-11 h-11 shrink-0 rounded cursor-pointer border-none p-0"
              />
              <Input
                type="text"
                aria-label="Couleur secondaire, code hexadécimal"
                className="py-1"
                value={designSettings.secondaryColor}
                onChange={(e) => setDesignSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </details>

      <section className="stitch-panel">
        <div className="stitch-panel-header">Typographie</div>
        <div className="p-3">
          <Select label="Police du CV" value={designSettings.fontFamily}
            options={FONT_OPTIONS.map(font => ({ value: font.id, label: font.name }))}
            onChange={event => setDesignSettings(prev => ({ ...prev, fontFamily: event.target.value as FontFamily }))} />
        </div>
      </section>

      {/* The title weight / case / spacing, paper size and orientation controls
          were removed on 2026-09-15: no renderer ever read them, every template
          fixes those choices and pages are always A4 portrait. */}
      <section className="stitch-panel">
        <div className="stitch-panel-header">Options</div>
        <div className="p-4 space-y-3">
          <div>
            <div className="px-3 py-2 rounded border border-gray-200 bg-gray-50 text-[11px] stitch-mono text-gray-600">
              {actualPageCount} page{actualPageCount > 1 ? 's' : ''} {actualPageCount > 2 && <span className="text-amber-700 ml-1">(les recruteurs préfèrent 1 à 2 pages)</span>}
            </div>
            <div className="mt-3">
              <Toggle
                label="Afficher la photo"
                checked={Boolean(designSettings.showPhoto)}
                onChange={(showPhoto) => setDesignSettings(prev => ({ ...prev, showPhoto }))}
              />
              <p className="mt-1 text-[11px] text-gray-600">
                Attendue en France, en Allemagne et en Suisse. À retirer pour les États-Unis,
                le Royaume-Uni, le Canada et l'Irlande, où elle expose le recruteur à un risque
                de discrimination.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="stitch-panel">
        <div className="stitch-panel-header">Sections visibles</div>
        <div className="p-4 space-y-2">
          {[
            { id: 'summary', label: 'Résumé professionnel' },
            { id: 'experience', label: 'Expériences' },
            { id: 'education', label: 'Formations' },
            { id: 'skills', label: 'Compétences' },
            { id: 'languages', label: 'Langues' },
          ].map((section) => {
            const included = designSettings.includedSections?.includes(section.id) ?? true;
            return (
              <Toggle
                key={section.id}
                label={section.label}
                variant="visibility"
                checked={included}
                onChange={() => {
                  const current = designSettings.includedSections ?? ['personal', 'summary', 'experience', 'education', 'skills', 'languages'];
                  const updated = included
                    ? current.filter(s => s !== section.id)
                    : [...current, section.id];
                  // Always keep 'personal'
                  if (!updated.includes('personal')) updated.unshift('personal');
                  setDesignSettings(prev => ({ ...prev, includedSections: updated }));
                }}
              />
            );
          })}
          <p className="text-[11px] text-gray-600 mt-2 italic">Les sections masquées ne sont pas supprimées : elles disparaissent seulement de l'aperçu, du PDF et du Word.</p>
        </div>
      </section>


    </div>
  );
});
