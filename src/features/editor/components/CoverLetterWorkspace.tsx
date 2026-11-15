import { PDF_TEXT_STYLE } from '../lib/pdf-styles';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Download, Undo2, FileText } from 'lucide-react';
import { Button } from '@/src/shared/ui/Button';
import { Input } from '@/src/shared/ui/Input';
import { Textarea } from '@/src/shared/ui/Textarea';
import { COMPANY_STAGE_OPTIONS, COMPANY_BUSINESS_MODEL_OPTIONS } from '@/src/shared/constants/company-meta';
import { MIN_OFFER_CHARS, type PersonalInfo } from '@/src/shared/types';
import type { LetterSelection, UseCoverLetterResult } from '../hooks/useCoverLetter';
import { buildLetterDateLine, getLetterLanguage, type CoverLetterData } from '../lib/cover-letter-drafts';

interface Props {
  controller: UseCoverLetterResult; personalInfo?: PersonalInfo;
  onOfferCommit: (value: string) => void;
  notify: (args: { message: string; type: 'success' | 'error' }) => void;
}
const labels: Record<keyof CoverLetterData, string> = { subject: 'Objet', greeting: 'Formule d’appel', body: 'Texte de la lettre', closing: 'Formule de fin' };
function LetterField({ field, value, disabled, onChange, onSelection }: {
  field: keyof CoverLetterData; value: string; disabled: boolean;
  onChange: (field: keyof CoverLetterData, value: string) => void; onSelection: (selection: LetterSelection | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (element) { element.style.height = '0px'; element.style.height = `${element.scrollHeight + 4}px`; }
    if (!element) return;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => { if (element.clientWidth === width) return; width = element.clientWidth; element.style.height = '0px'; element.style.height = `${element.scrollHeight + 4}px`; });
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);
  return <textarea ref={ref} aria-label={labels[field]} value={value} disabled={disabled} rows={1}
    className={`w-full resize-none overflow-hidden bg-transparent rounded-sm outline-none border border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 p-1 -ml-1 ${field === 'subject' ? 'font-bold' : ''}`}
    style={{ font: 'inherit', fontWeight: field === 'subject' ? 700 : undefined, lineHeight: 'inherit' }}
    onChange={event => onChange(field, event.target.value)}
    onSelect={event => { const el = event.currentTarget; onSelection(el.selectionEnd > el.selectionStart ? { field, start: el.selectionStart, end: el.selectionEnd } : null); }} />;
}

/** A document in the editor, replacing the old modal and its duplicate offer. */
export function CoverLetterWorkspace({ controller: c, personalInfo, notify, onOfferCommit }: Props) {
  const [contextOpen, setContextOpen] = useState(!c.letter);
  useEffect(() => { if (c.letter) setContextOpen(false); }, [Boolean(c.letter)]);
  const [selection, setSelection] = useState<LetterSelection | null>(null);
  const [exporting, setExporting] = useState(false);
  const [offerDraft, setOfferDraft] = useState(c.jobDescription);
  useEffect(() => { setOfferDraft(c.jobDescription); }, [c.jobDescription]);
  const [offerOpen, setOfferOpen] = useState(c.jobDescription.trim().length < MIN_OFFER_CHARS);
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => { setSelection(null); }, [c.letter]);
  const words = c.letter ? Object.values(c.letter).join(' ').trim().split(/\s+/u).filter(Boolean).length : 0;
  const statusLabel = c.status === 'error' ? 'Sauvegarde à réessayer' : c.status === 'saving' || c.status === 'pending' ? 'Enregistrement…' : 'Enregistré';
  const exportLetter = async (format: 'pdf' | 'docx') => {
    if (!c.letter || !personalInfo || exporting) return;
    setExporting(true);
    try {
      const { exportLetterToPdf, exportLetterToDocx } = await import('@/src/shared/lib/export-letter');
      const options = { letter: c.letter, personalInfo, companyName: c.companyName, language: getLetterLanguage(c.letter) };
      await (format === 'pdf' ? exportLetterToPdf(options) : exportLetterToDocx(options));
    } catch {
      notify({ message: 'Export impossible. Votre lettre reste disponible : réessayez ou utilisez Copier.', type: 'error' });
    } finally { setExporting(false); }
  };
  return <section aria-label="Lettre de motivation" className="flex flex-col flex-1 min-h-0" onKeyDown={event => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || event.shiftKey) return;
    // The CV's global undo must not run while the letter is being edited.
    event.stopPropagation();
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)) { event.preventDefault(); c.undo(); }
  }}>
    <header className="min-h-14 bg-white border-b border-gray-200 px-3 sm:px-5 flex flex-wrap items-center justify-between gap-2 py-2">
      <nav aria-label="Documents de la candidature" className="flex items-center gap-1 text-sm">
        <button ref={firstRef} onClick={c.close} className="px-3 py-2 rounded hover:bg-gray-100" aria-label="Revenir au CV">CV</button>
        <span aria-current="page" className="px-3 py-2 rounded bg-blue-50 text-blue-700 font-semibold">Lettre</span>
      </nav>
      <div className="flex items-center gap-2">
        <Button mono={false} variant="ghost" size="sm" onClick={c.copy} disabled={!c.letter} icon={<Copy className="w-4 h-4" />}>Copier</Button>
        <details className="relative" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
          <summary role="button" aria-label="Exporter la lettre" className="list-none cursor-pointer px-3 py-2 bg-blue-600 text-white rounded flex items-center gap-2 text-sm"><Download className="w-4 h-4" />{exporting ? 'Export…' : 'Exporter'}</summary>
          <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded shadow-sm p-1 z-20 flex flex-col text-sm" onClick={event => { if ((event.target as HTMLElement).closest('button')) event.currentTarget.closest('details')?.removeAttribute('open'); }}>
            <button className="p-3 text-left hover:bg-gray-100" disabled={!c.letter || exporting} onClick={() => void exportLetter('pdf')}>Exporter en PDF</button>
            <button className="p-3 text-left hover:bg-gray-100" disabled={!c.letter || exporting} onClick={() => void exportLetter('docx')}>Télécharger en Word (.docx)</button>
            <button className="p-3 text-left hover:bg-gray-100" disabled={!c.letter} onClick={c.download}>Exporter en texte (.txt)</button>
          </div>
        </details>
      </div>
    </header>
    <div className="flex-1 min-h-0 overflow-y-auto md:flex md:overflow-hidden">
      <aside aria-label="Contexte de candidature" className="md:w-80 md:shrink-0 md:overflow-y-auto border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50 p-4 md:p-5 grid grid-cols-[1fr_auto] md:block gap-3 md:space-y-5">
        <div>
          <Link to="/dashboard" className="hidden md:inline text-xs text-gray-600 hover:underline">Tableau de bord</Link>
          <h1 className="text-base md:text-lg font-semibold md:mt-3">{c.companyName || 'Votre candidature'}</h1>
          <p className="hidden md:block text-xs text-gray-600 mt-1">Le CV et la lettre utilisent la même offre.</p>
        </div>
        <button className="md:hidden text-xs text-blue-700 underline" aria-expanded={contextOpen} onClick={() => setContextOpen(!contextOpen)}>{contextOpen ? 'Réduire les réglages' : 'Contexte et options'}</button>
        <div className={`${contextOpen ? '' : 'hidden'} col-span-2 md:block space-y-5`}>
        {c.legacyDraftAvailable && <div className="text-sm text-gray-600"><p>Un ancien brouillon est conservé dans ce navigateur. Vérifiez son offre avant de le réutiliser.</p><button className="underline text-blue-700 mt-2" onClick={c.importLegacyDraft}>Importer l’ancien brouillon</button></div>}
        {!c.ready ? <p role="status">Chargement du brouillon…</p> : <>
          <Input label="Entreprise" value={c.companyName} maxLength={200} onChange={e => c.setCompanyName(e.target.value)} placeholder="Nom de l’entreprise" />
          <div>
            <button aria-expanded={offerOpen} onClick={() => setOfferOpen(!offerOpen)} className="text-sm text-blue-700 underline">{offerOpen ? 'Réduire l’offre' : 'Modifier l’offre commune'}</button>
            {offerOpen ? <Textarea label="Offre d’emploi commune" value={offerDraft} maxLength={20000} rows={5} onChange={e => setOfferDraft(e.target.value)} onBlur={() => onOfferCommit(offerDraft)} /> : <p className="text-xs text-gray-600 line-clamp-2 mt-2">{c.jobDescription}</p>}
          </div>
          <Textarea label="Pourquoi ce poste vous intéresse-t-il ?" value={c.motivation} maxLength={2000} rows={3}
            placeholder="Une motivation personnelle, un projet à mettre en avant… (facultatif)" onChange={e => c.setMotivation(e.target.value)} />
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-700 py-1">Options de rédaction</summary>
            <div className="space-y-3 mt-3">
              <label className="block">Ton<select aria-label="Ton" value={c.tone} onChange={e => c.setTone(e.target.value)} className="w-full border border-gray-300 rounded p-2 mt-1 bg-white">
                <option value="professionnel et engagé">Professionnel et engagé</option><option value="formel et académique">Formel</option><option value="direct et naturel">Direct et naturel</option>
              </select></label>
              <label className="block">Stade de l’entreprise<select aria-label="Stade de l’entreprise" value={c.companyStage} onChange={e => c.setCompanyStage(e.target.value)} className="w-full border border-gray-300 rounded p-2 mt-1 bg-white"><option value="">Non précisé</option>{COMPANY_STAGE_OPTIONS.map(v => <option key={v}>{v}</option>)}</select></label>
              <label className="block">Modèle économique<select aria-label="Modèle économique" value={c.companyBusinessModel} onChange={e => c.setCompanyBusinessModel(e.target.value)} className="w-full border border-gray-300 rounded p-2 mt-1 bg-white"><option value="">Non précisé</option>{COMPANY_BUSINESS_MODEL_OPTIONS.map(v => <option key={v}>{v}</option>)}</select></label>
            </div>
          </details>
          <Button mono={false} fullWidth loading={c.isGenerating} disabled={c.jobDescription.trim().length < MIN_OFFER_CHARS} onClick={() => void c.generate()}>{c.letter ? 'Réécrire la lettre' : 'Rédiger ma lettre'}</Button>
          {c.jobDescription.trim().length < MIN_OFFER_CHARS && <p className="text-xs text-gray-600">Ajoutez une offre d’au moins 50 caractères.</p>}
          {c.letter && <p className="text-xs text-gray-600">Une réécriture peut être annulée. La langue suit celle du CV au moment de la rédaction.</p>}
        </>}
        </div>
      </aside>
      <div className="flex-1 min-w-0 md:overflow-y-auto p-3 sm:p-6 bg-[#F1F3F4]">
        <div className="max-w-[794px] mx-auto flex flex-wrap justify-between items-center gap-2 mb-3 text-xs text-gray-600">
          <span role="status" aria-live="polite">{statusLabel}{c.status === 'saved' ? ` automatiquement ${c.storageLabel}` : ''}</span>
          {c.status === 'error' && <button className="underline text-blue-700" onClick={() => void c.save()}>Réessayer la sauvegarde</button>}
          {c.letter && <span>{words} mots{words > 350 ? ' : dépasse la limite conseillée de 350' : ''}</span>}
        </div>
        {c.letter && <div aria-label="Révisions de la lettre" className="max-w-[794px] mx-auto flex flex-wrap gap-2 mb-4">
          <Button mono={false} variant="secondary" size="sm" disabled={c.isGenerating} onClick={() => void c.generate('shorten')}>Raccourcir</Button>
          <Button mono={false} variant="secondary" size="sm" disabled={c.isGenerating || !selection} onMouseDown={e => e.preventDefault()} onClick={() => void c.generate('rephrase', selection ?? undefined)}>Reformuler la sélection</Button>
          <Button mono={false} variant="ghost" size="sm" disabled={c.isGenerating || !c.canUndo} onClick={c.undo} icon={<Undo2 className="w-4 h-4" />}>Annuler</Button>
          <span className="w-full text-xs text-gray-500">Sélectionnez un passage dans le document pour le reformuler.</span>
        </div>}
        {!c.letter ? <div className="max-w-[794px] mx-auto bg-white min-h-80 p-8 sm:p-14 border border-gray-200">
          <FileText className="w-6 h-6 text-gray-400 mb-5" /><h2 className="text-xl font-semibold">Une lettre pour cette offre</h2>
          <p className="text-sm text-gray-600 mt-3 max-w-md">Ajoutez votre motivation si vous le souhaitez, puis lancez la rédaction. Vous pourrez modifier le texte directement ici.</p>
        </div> : <article aria-label="Document lettre" className="max-w-[794px] min-h-[900px] mx-auto bg-white border border-gray-200 p-6 sm:p-14 lg:px-[83px] lg:py-[94px]"
          style={{ ...PDF_TEXT_STYLE, fontFamily: 'Calibri, Carlito, Arial, sans-serif', fontSize: '11pt', lineHeight: 1.55, color: '#1a1a1a' }}>
          <p className="font-bold text-base">{personalInfo?.name}</p><p className="text-xs text-gray-600 mb-8">{[personalInfo?.email, personalInfo?.phone, personalInfo?.location].filter(Boolean).join(' · ')}</p>
          <p className="text-right mb-6">{buildLetterDateLine(getLetterLanguage(c.letter), personalInfo?.location)}</p>
          {(Object.keys(labels) as (keyof CoverLetterData)[]).map(field => <div key={field} className={field === 'subject' ? 'mb-6' : 'mb-4'}><LetterField field={field} value={c.letter![field]} disabled={c.isGenerating} onChange={c.updateLetterField} onSelection={setSelection} /></div>)}
          <p className="font-bold">{personalInfo?.name}</p>
        </article>}
      </div>
    </div>
  </section>;
}
