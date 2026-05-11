import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, FileText, Sparkles, Copy, Download, Save } from 'lucide-react';
import { Button } from '@/src/shared/ui/Button';
import { Input } from '@/src/shared/ui/Input';
import { Textarea } from '@/src/shared/ui/Textarea';
import { Panel, PanelHeader, PanelBody } from '@/src/shared/ui/Panel';
import { canSave, type UseCoverLetterResult, type CoverLetterData } from '../hooks/useCoverLetter';
import { COMPANY_STAGE_OPTIONS, COMPANY_BUSINESS_MODEL_OPTIONS } from '@/convex/_ai/schemas';

interface Props {
  controller: UseCoverLetterResult;
  user: unknown;
  cvName?: string;
}

const TONE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'professionnel et engagé', label: 'Pro & engagé' },
  { value: 'formel et académique', label: 'Formel' },
  { value: 'dynamique et startup', label: 'Startup' },
  { value: 'créatif et original', label: 'Créatif' },
];

const SUBTLE_SELECT_CLASSES =
  "w-full text-[11px] font-mono text-gray-500 bg-gray-50/60 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:bg-white focus:text-gray-700 transition-colors cursor-pointer";

export function CoverLetterDrawer({ controller, user, cvName }: Props) {
  const { isOpen, close, letter, setLetter } = controller;

  // ─── Escape-to-close ───
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  const updateLetterField = (field: keyof CoverLetterData, value: string) => {
    if (!letter) return;
    setLetter({ ...letter, [field]: value });
  };

  const saveDisabled = !canSave(user, letter);
  const generateDisabled = controller.localJobDescription.length < 50;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            className="fixed top-0 right-0 h-full w-full max-w-xl bg-[#F8F9FA] shadow-2xl flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <header className="h-12 border-b border-[var(--border-color)] bg-white flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <span className="font-mono text-[11px] uppercase tracking-wider font-bold">
                  LETTRE_DE_MOTIVATION
                </span>
              </div>
              <Button variant="ghost" size="sm" icon={<X className="w-4 h-4" />} onClick={close} aria-label="Fermer">
                {''}
              </Button>
            </header>

            {/* Body (scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!controller.isTailored && controller.localJobDescription.length >= 50 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-800">
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <span>Votre CV n'a pas encore été optimisé pour cette offre. La lettre sera basée sur votre CV de base — résultats moins ciblés.</span>
                </div>
              )}
              <Panel>
                <PanelHeader>Configuration</PanelHeader>
                <PanelBody className="space-y-4">
                  <Input
                    label="Nom de l'entreprise"
                    value={controller.companyName}
                    onChange={(e) => controller.setCompanyName(e.target.value)}
                    placeholder={controller.isExtractingCompany ? 'Détection automatique...' : 'Ex: Google, Airbus...'}
                  />

                  <div className="grid grid-cols-2 gap-2 -mt-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider">Stade</span>
                      <select
                        value={controller.companyStage}
                        onChange={(e) => controller.setCompanyStage(e.target.value)}
                        className={SUBTLE_SELECT_CLASSES}
                        aria-label="Stade de l'entreprise"
                      >
                        <option value="">— Non précisé</option>
                        {COMPANY_STAGE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider">Modèle</span>
                      <select
                        value={controller.companyBusinessModel}
                        onChange={(e) => controller.setCompanyBusinessModel(e.target.value)}
                        className={SUBTLE_SELECT_CLASSES}
                        aria-label="Modèle économique"
                      >
                        <option value="">— Non précisé</option>
                        {COMPANY_BUSINESS_MODEL_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <Textarea
                    label="Offre d'emploi"
                    value={controller.localJobDescription}
                    onChange={(e) => controller.setLocalJobDescription(e.target.value)}
                    placeholder="Collez l'offre d'emploi ici (min. 50 caractères)..."
                    rows={6}
                  />

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">Ton</label>
                    <div className="grid grid-cols-2 gap-2">
                      {TONE_OPTIONS.map((t) => {
                        const active = controller.tone === t.value;
                        return (
                          <Button
                            key={t.value}
                            variant="ghost"
                            size="xs"
                            onClick={() => controller.setTone(t.value)}
                            className={
                              active
                                ? 'bg-purple-50 border border-purple-200 text-purple-700'
                                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }
                          >
                            {t.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    fullWidth
                    size="md"
                    loading={controller.isGenerating}
                    icon={<Sparkles className="w-4 h-4" />}
                    disabled={generateDisabled}
                    onClick={controller.generate}
                  >
                    GÉNÉRER
                  </Button>
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader>Résultat</PanelHeader>
                <PanelBody>
                  {!letter ? (
                    <div className="py-12 text-center">
                      <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-xs text-gray-400">Générez pour voir l'aperçu</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Textarea
                        label="Objet"
                        value={letter.subject}
                        onChange={(e) => updateLetterField('subject', e.target.value)}
                        rows={2}
                      />
                      <Textarea
                        label="Salutation"
                        value={letter.greeting}
                        onChange={(e) => updateLetterField('greeting', e.target.value)}
                        rows={2}
                      />
                      <Textarea
                        label="Corps"
                        value={letter.body}
                        onChange={(e) => updateLetterField('body', e.target.value)}
                        rows={10}
                      />
                      <Textarea
                        label="Clôture"
                        value={letter.closing}
                        onChange={(e) => updateLetterField('closing', e.target.value)}
                        rows={2}
                      />
                      {cvName && (
                        <p className="text-[10px] font-mono text-gray-400 italic">
                          Signature: {cvName}
                        </p>
                      )}
                    </div>
                  )}
                </PanelBody>
              </Panel>
            </div>

            {/* Footer (sticky) */}
            <footer className="border-t border-[var(--border-color)] bg-white px-4 py-3 shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Copy className="w-3.5 h-3.5" />}
                  disabled={!letter}
                  onClick={controller.copy}
                >
                  Copier
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  disabled={!letter}
                  onClick={controller.download}
                >
                  Télécharger
                </Button>
                <div className="flex-1" />
                <div className="flex flex-col items-end gap-0.5">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Save className="w-3.5 h-3.5" />}
                    loading={controller.isSaving}
                    disabled={saveDisabled}
                    onClick={controller.save}
                  >
                    Sauvegarder
                  </Button>
                  {!user && (
                    <span className="text-[9px] text-gray-400 font-mono">
                      Connectez-vous pour sauvegarder
                    </span>
                  )}
                </div>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
