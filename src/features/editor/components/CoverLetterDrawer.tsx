import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, FileText, Sparkles, Copy, Download, Save, RotateCcw, Loader2 } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/src/shared/ui/Button';
import { Input } from '@/src/shared/ui/Input';
import { Textarea } from '@/src/shared/ui/Textarea';
import { Panel, PanelHeader, PanelBody } from '@/src/shared/ui/Panel';
import { canSave, findLatestSavedForCv, getLetterLanguage, type UseCoverLetterResult, type CoverLetterData } from '../hooks/useCoverLetter';
import { COMPANY_STAGE_OPTIONS, COMPANY_BUSINESS_MODEL_OPTIONS } from '@/src/shared/constants/companyMeta';
import type { PersonalInfo } from '@/src/shared/types';

interface Props {
  controller: UseCoverLetterResult;
  user: unknown;
  cvName?: string;
  /** Candidate info for the letter header in the PDF and Word exports */
  personalInfo?: PersonalInfo;
  notify: (args: { message: string; type: 'success' | 'error' }) => void;
}

const TONE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'professionnel et engagé', label: 'Pro & engagé' },
  { value: 'formel et académique', label: 'Formel' },
  { value: 'dynamique et startup', label: 'Startup' },
  { value: 'créatif et original', label: 'Créatif' },
];

const SUBTLE_SELECT_CLASSES =
  "w-full text-[11px] font-mono text-gray-500 bg-gray-50/60 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:bg-white focus:text-gray-700 transition-colors cursor-pointer";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const isEditableField = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLElement &&
  (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');

export function CoverLetterDrawer({ controller, user, cvName, personalInfo, notify }: Props) {
  const { isOpen, close, letter, setLetter } = controller;
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Saved letters (signed-in only; guests have no Convex identity, skip the query)
  const savedLetters = useQuery(api.coverLetters.list, user ? {} : 'skip');
  const savedForThisCv = findLatestSavedForCv(savedLetters, controller.cvId);

  // ─── A11y: initial focus, focus trap, two-step Escape, focus restore ───
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const getFocusable = (): HTMLElement[] =>
      Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);

    // Remember the opener, then move focus inside (first focusable = close button)
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    getFocusable()[0]?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Two-step: first Escape from a field blurs it, next Escape closes
        if (isEditableField(document.activeElement)) {
          document.activeElement.blur();
        } else {
          close();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && Boolean(drawerRef.current?.contains(active));
      if (e.shiftKey) {
        if (!inside || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, close]);

  const updateLetterField = (field: keyof CoverLetterData, value: string) =>
    controller.updateLetterField(field, value);

  const reloadSavedLetter = () => {
    if (!savedForThisCv) return;
    setLetter({
      subject: savedForThisCv.subject,
      greeting: savedForThisCv.greeting,
      body: savedForThisCv.body,
      closing: savedForThisCv.closing,
    });
  };

  const saveDisabled = !canSave(user, letter);
  const generateDisabled = controller.localJobDescription.length < 50;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Lettre de motivation"
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
                <span className="text-[12px] uppercase tracking-wider font-bold">
                  Lettre de motivation
                </span>
              </div>
              <Button variant="ghost" size="sm" icon={<X className="w-4 h-4" />} onClick={close} aria-label="Fermer">
                {''}
              </Button>
            </header>

            {/* Body (scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!controller.isTailoredForLocalJD && controller.localJobDescription.length >= 50 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-800">
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <span>Votre CV n'a pas encore été optimisé pour cette offre. La lettre sera basée sur votre CV de base : résultats moins ciblés.</span>
                </div>
              )}
              {/* Une lettre mémorisée qui ne parle pas de l'offre ouverte. Jamais
                  restaurée d'office : elle argumentait pour un autre poste. */}
              {!letter && controller.staleStoredLetter && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-800">
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <div className="min-w-0 flex-1">
                    <p>Une lettre écrite pour une <strong>autre offre</strong> est encore en mémoire. Elle n'a pas été chargée pour éviter de candidater avec le mauvais texte.</p>
                    <button
                      type="button"
                      onClick={() => setLetter(controller.staleStoredLetter!)}
                      className="mt-1 underline hover:no-underline font-bold"
                    >
                      L'afficher quand même
                    </button>
                  </div>
                </div>
              )}
              {!letter && savedForThisCv && (
                <Button
                  variant="ghost"
                  size="xs"
                  fullWidth
                  icon={<RotateCcw className="w-3 h-3" />}
                  onClick={reloadSavedLetter}
                  className="border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  {savedForThisCv.companyName
                    ? `Recharger la lettre sauvegardée (${savedForThisCv.companyName})`
                    : 'Recharger la dernière lettre sauvegardée'}
                </Button>
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
                      <span className="text-[11px] font-mono text-gray-600 uppercase tracking-wider">Stade</span>
                      <select
                        value={controller.companyStage}
                        onChange={(e) => controller.setCompanyStage(e.target.value)}
                        className={SUBTLE_SELECT_CLASSES}
                        aria-label="Stade de l'entreprise"
                      >
                        <option value="">Non précisé</option>
                        {COMPANY_STAGE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-mono text-gray-600 uppercase tracking-wider">Modèle</span>
                      <select
                        value={controller.companyBusinessModel}
                        onChange={(e) => controller.setCompanyBusinessModel(e.target.value)}
                        className={SUBTLE_SELECT_CLASSES}
                        aria-label="Modèle économique"
                      >
                        <option value="">Non précisé</option>
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
                  {controller.jdOutOfSync && (
                    <div className="flex items-center justify-between gap-2 -mt-2">
                      <span className="text-[11px] text-gray-600 font-mono">
                        L'offre de l'éditeur a changé depuis vos modifications.
                      </span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={controller.syncJobDescription}
                        className="border border-gray-200 text-gray-600 hover:bg-gray-50 shrink-0"
                      >
                        Utiliser l'offre courante
                      </Button>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-gray-500 uppercase tracking-wider block">Ton</label>
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
                    Générer la lettre
                  </Button>
                  <p className="text-[11px] text-gray-500 text-center">Rédigée par l'IA à partir de votre CV et de l'offre (environ 30 secondes).</p>
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader>Résultat</PanelHeader>
                <PanelBody>
                  {!letter ? (
                    <div className="py-12 text-center">
                      <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-xs text-gray-600">Générez pour voir l'aperçu</p>
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
                        <p className="text-[11px] font-mono text-gray-600 italic">
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
                  title="Copie l'objet, la formule d'appel, le corps, la clôture et votre nom"
                >
                  Tout copier
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  disabled={!letter || !personalInfo || isExportingPdf}
                  title="Télécharger la lettre mise en page (.pdf)"
                  onClick={async () => {
                    if (!letter || !personalInfo) return;
                    setIsExportingPdf(true);
                    try {
                      const { exportLetterToPdf } = await import('@/src/shared/lib/export-letter');
                      await exportLetterToPdf({
                        letter,
                        personalInfo,
                        companyName: controller.companyName || undefined,
                        // The letter's own language, not the CV's: labels and date follow it
                        language: getLetterLanguage(letter),
                      });
                    } catch (e) {
                      console.error('Letter PDF export failed:', e);
                      notify({ message: 'Export PDF impossible. Utilisez Word ou Copier.', type: 'error' });
                    } finally {
                      setIsExportingPdf(false);
                    }
                  }}
                >
                  PDF
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  disabled={!letter || !personalInfo}
                  title="Télécharger une lettre mise en page (.docx)"
                  onClick={async () => {
                    if (!letter || !personalInfo) return;
                    // A failed Word export used to fail silently
                    try {
                      const { exportLetterToDocx } = await import('@/src/shared/lib/export-letter');
                      await exportLetterToDocx({
                        letter,
                        personalInfo,
                        companyName: controller.companyName || undefined,
                        language: getLetterLanguage(letter),
                      });
                    } catch (e) {
                      console.error('Letter Word export failed:', e);
                      notify({ message: 'Export Word impossible. Utilisez le PDF ou Copier.', type: 'error' });
                    }
                  }}
                >
                  Word
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Download className="w-3.5 h-3.5" />}
                  disabled={!letter}
                  onClick={controller.download}
                  title="Télécharger en texte brut (.txt)"
                >
                  Texte
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
                    <span className="text-[11px] text-gray-600 font-mono">
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
