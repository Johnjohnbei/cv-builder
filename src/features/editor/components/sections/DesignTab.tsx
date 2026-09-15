import { memo } from 'react';
import { Download, Eye, Loader2, Mail } from 'lucide-react';
import { cn } from '../../../../shared/lib/cn';
import { Input } from '../../../../shared/ui/Input';
import { Button } from '../../../../shared/ui/Button';
import { TemplatePicker } from './TemplatePicker';
import type { DesignSettings } from '../../../../shared/types';

type FontFamily = DesignSettings['fontFamily'];

const FONT_OPTIONS: ReadonlyArray<{ id: FontFamily; name: string }> = [
  { id: 'sans', name: 'Inter (Sans)' },
  { id: 'serif', name: 'Georgia (Serif)' },
  { id: 'mono', name: 'JetBrains (Mono)' },
  { id: 'playfair', name: 'Playfair (Display)' },
  { id: 'outfit', name: 'Outfit (Modern)' },
];

interface ColorTheme { name: string; p: string; s: string; f: FontFamily }
const COLOR_THEMES: ReadonlyArray<ColorTheme> = [
  { name: 'Corporate', p: '#1e293b', s: '#64748b', f: 'sans' },
  { name: 'Creative', p: '#f97316', s: '#0f172a', f: 'outfit' },
  { name: 'Elegant', p: '#111827', s: '#94a3b8', f: 'playfair' },
  { name: 'Tech', p: '#2563eb', s: '#475569', f: 'mono' },
];

interface Props {
  designSettings: DesignSettings;
  setDesignSettings: React.Dispatch<React.SetStateAction<DesignSettings>>;
  selectedTemplate: string;
  onRequestTemplateChange: (templateId: string) => void;
  actualPageCount: number;
  onPreviewPDF: () => void;
  onDownloadPDF: () => void;
  isExporting: boolean;
  onExportDocx: () => void;
  isExportingDocx: boolean;
  onOpenCoverLetter: () => void;
}

export const DesignTab = memo(function DesignTab({
  designSettings, setDesignSettings, selectedTemplate, onRequestTemplateChange,
  actualPageCount, onPreviewPDF, onDownloadPDF, isExporting, onExportDocx, isExportingDocx,
  onOpenCoverLetter,
}: Props) {
  return (
    <div className="space-y-6">
      <TemplatePicker
        selectedTemplate={selectedTemplate}
        primaryColor={designSettings.primaryColor}
        onRequestTemplateChange={onRequestTemplateChange}
      />

      <section className="stitch-panel">
        <div className="stitch-panel-header">Thèmes rapides</div>
        <div className="p-4 grid grid-cols-2 gap-2">
          {COLOR_THEMES.map((theme) => (
            <button
              key={theme.name}
              onClick={() => setDesignSettings(prev => ({
                ...prev,
                primaryColor: theme.p,
                secondaryColor: theme.s,
                fontFamily: theme.f,
              }))}
              className="p-2 border border-gray-200 rounded text-[11px] stitch-mono hover:bg-gray-50 transition-all text-left flex flex-col gap-1"
            >
              <span className="font-bold">{theme.name}</span>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.p }} />
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.s }} />
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="stitch-panel">
        <div className="stitch-panel-header">Couleurs</div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-[11px] stitch-mono text-gray-500 uppercase block mb-2">Préréglages</label>
            <div className="flex flex-wrap gap-2">
              {[
                { p: '#1A73E8', s: '#5F6368' }, // Google
                { p: '#000000', s: '#666666' }, // Noir
                { p: '#2D3436', s: '#636E72' }, // Slate
                { p: '#0984E3', s: '#74B9FF' }, // Blue
                { p: '#6C5CE7', s: '#A29BFE' }, // Purple
                { p: '#00B894', s: '#55EFC4' }, // Green
                { p: '#D63031', s: '#FF7675' }, // Red
              ].map((preset, i) => (
                <button
                  key={i}
                  onClick={() => setDesignSettings(prev => ({ ...prev, primaryColor: preset.p, secondaryColor: preset.s }))}
                  className="w-6 h-6 rounded border border-gray-200 flex overflow-hidden"
                >
                  <div className="flex-1" style={{ backgroundColor: preset.p }} />
                  <div className="flex-1" style={{ backgroundColor: preset.s }} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] stitch-mono text-gray-500 uppercase block mb-2">Couleur principale</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={designSettings.primaryColor}
                onChange={(e) => setDesignSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                className="w-8 h-8 rounded cursor-pointer border-none p-0"
              />
              <Input
                type="text"
                className="py-1"
                value={designSettings.primaryColor}
                onChange={(e) => setDesignSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] stitch-mono text-gray-500 uppercase block mb-2">Couleur secondaire</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={designSettings.secondaryColor}
                onChange={(e) => setDesignSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                className="w-8 h-8 rounded cursor-pointer border-none p-0"
              />
              <Input
                type="text"
                className="py-1"
                value={designSettings.secondaryColor}
                onChange={(e) => setDesignSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="stitch-panel">
        <div className="stitch-panel-header">Typographie</div>
        <div className="p-4 space-y-3">
          {FONT_OPTIONS.map((font) => (
            <button
              key={font.id}
              onClick={() => setDesignSettings(prev => ({ ...prev, fontFamily: font.id }))}
              className={cn(
                "w-full text-left px-3 py-2 rounded border text-[11px] stitch-mono transition-colors",
                designSettings.fontFamily === font.id
                  ? "bg-blue-50 border-blue-200 text-blue-700 font-bold"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {font.name}
            </button>
          ))}
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
              {actualPageCount} page{actualPageCount > 1 ? 's' : ''} {actualPageCount > 2 && <span className="text-amber-600 ml-1">(les recruteurs préfèrent 1 à 2 pages)</span>}
            </div>
            <div className="mt-3">
              <button
                onClick={() => setDesignSettings(prev => ({ ...prev, showPhoto: !prev.showPhoto }))}
                aria-pressed={Boolean(designSettings.showPhoto)}
                className={cn(
                  "w-full px-2 py-2 rounded border text-[11px] stitch-mono transition-colors flex items-center justify-between",
                  designSettings.showPhoto
                    ? "bg-blue-50 border-blue-200 text-blue-700 font-bold"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                <span>Afficher la photo</span>
                <div className={cn(
                  "w-8 h-4 rounded-full relative transition-colors",
                  designSettings.showPhoto ? "bg-blue-600" : "bg-gray-300"
                )}>
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                    designSettings.showPhoto ? "left-4.5" : "left-0.5"
                  )} />
                </div>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="stitch-panel">
        <div className="stitch-panel-header">Sections visibles</div>
        <div className="p-4 space-y-2">
          {[
            { id: 'summary', label: 'Résumé professionnel', icon: '📝' },
            { id: 'experience', label: 'Expériences', icon: '💼' },
            { id: 'education', label: 'Formations', icon: '🎓' },
            { id: 'skills', label: 'Compétences', icon: '⚡' },
            { id: 'languages', label: 'Langues', icon: '🌍' },
          ].map((section) => {
            const included = designSettings.includedSections?.includes(section.id) ?? true;
            return (
              <button
                key={section.id}
                aria-pressed={included}
                onClick={() => {
                  const current = designSettings.includedSections ?? ['personal', 'summary', 'experience', 'education', 'skills', 'languages'];
                  const updated = included
                    ? current.filter(s => s !== section.id)
                    : [...current, section.id];
                  // Always keep 'personal'
                  if (!updated.includes('personal')) updated.unshift('personal');
                  setDesignSettings(prev => ({ ...prev, includedSections: updated }));
                }}
                className={cn(
                  "w-full px-3 py-2 rounded border text-[11px] stitch-mono transition-colors flex items-center justify-between",
                  included
                    ? "bg-white border-gray-200 text-gray-800 hover:bg-gray-50"
                    : "bg-gray-100 border-gray-200 text-gray-600 line-through"
                )}
              >
                <span className="flex items-center gap-2">
                  <span>{section.icon}</span>
                  <span>{section.label}</span>
                </span>
                <div className={cn(
                  "w-8 h-4 rounded-full relative transition-colors",
                  included ? "bg-blue-600" : "bg-gray-300"
                )}>
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                    included ? "left-4.5" : "left-0.5"
                  )} />
                </div>
              </button>
            );
          })}
          <p className="text-[11px] text-gray-600 mt-2 italic">Les sections masquées ne sont pas supprimées : elles disparaissent seulement de l'aperçu, du PDF et du Word.</p>
        </div>
      </section>

      <section className="stitch-panel">
        <div className="stitch-panel-header">Export</div>
        <div className="p-4 space-y-3">
          <Button
            variant="secondary"
            fullWidth
            className="rounded-lg py-3 px-4 text-[11px] tracking-widest border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
            icon={<Eye className="w-4 h-4" />}
            onClick={onPreviewPDF}
          >
            Prévisualiser le PDF
          </Button>

          <Button
            variant="primary"
            fullWidth
            className="rounded-lg py-3 px-4 text-[11px] tracking-widest shadow-md"
            icon={isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            disabled={isExporting}
            onClick={onDownloadPDF}
          >
            {isExporting ? 'Export en cours...' : 'Télécharger le PDF'}
          </Button>

          <Button
            variant="secondary"
            fullWidth
            className="rounded-lg py-3 px-4 text-[11px] tracking-widest border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
            icon={isExportingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            disabled={isExportingDocx}
            onClick={onExportDocx}
          >
            {isExportingDocx ? 'Export en cours...' : 'Télécharger en Word (.docx)'}
          </Button>

          <Button
            variant="secondary"
            fullWidth
            className="rounded-lg py-3 px-4 text-[11px] tracking-widest border-2 border-purple-600 text-purple-600 hover:bg-purple-50"
            icon={<Mail className="w-4 h-4" />}
            onClick={onOpenCoverLetter}
          >
            Lettre de motivation
          </Button>
        </div>
      </section>
    </div>
  );
});
