import { PDF_TEXT_STYLE } from '../lib/pdf-styles';
import { useEffect, useRef, useState } from 'react';
import { X, FileText } from 'lucide-react';
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
  isSidebarOpen: boolean; onCloseSidebar: () => void;
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
export function CoverLetterWorkspace({ controller: c, personalInfo, isSidebarOpen, onCloseSidebar, onOfferCommit }: Props) {
  const [selection, setSelection] = useState<LetterSelection | null>(null);
  const [offerDraft, setOfferDraft] = useState(c.jobDescription);
  useEffect(() => { setOfferDraft(c.jobDescription); }, [c.jobDescription]);
  const [offerOpen, setOfferOpen] = useState(c.jobDescription.trim().length < MIN_OFFER_CHARS);
  useEffect(() => { setSelection(null); }, [c.letter]);
  const words = c.letter ? Object.values(c.letter).join(' ').trim().split(/\s+/u).filter(Boolean).length : 0;
  return <section aria-label="Lettre de motivation" className="flex flex-col flex-1 min-h-0 min-w-0">
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {isSidebarOpen && <>
      <div className="absolute inset-0 bg-black/40 z-40 md:hidden" onClick={onCloseSidebar} />
      <aside aria-label="Contexte de candidature" className="absolute inset-y-0 left-0 z-50 w-80 max-w-[85vw] md:relative md:shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50 p-5 space-y-5">
        <div>
          <div className="flex items-center justify-between gap-3"><h1 className="text-base font-semibold">{c.companyName || 'Votre candidature'}</h1><button onClick={onCloseSidebar} className="p-1.5 hover:bg-gray-100 rounded" aria-label="Fermer le panneau latéral"><X className="w-4 h-4" /></button></div>
          <p className="hidden md:block text-xs text-gray-600 mt-1">Le CV et la lettre utilisent la même offre.</p>
        </div>
        <div className="space-y-5">
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
              <Textarea label="Un exemple de votre écriture" value={c.writingSample} maxLength={2000} rows={4} placeholder="Un court texte écrit par vous (facultatif). Il guide le style, sans ajouter de faits à la lettre." onChange={e => c.setWritingSample(e.target.value)} />
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
      </>}
      <div className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-6 bg-[#F1F3F4]">
        <div className="max-w-[794px] mx-auto flex flex-wrap justify-between items-center gap-2 mb-3 text-xs text-gray-600">
          {c.letter && <span>{words} mots{words > 350 ? ' : dépasse la limite conseillée de 350' : ''}</span>}
        </div>
        {c.letter && <div aria-label="Révisions de la lettre" className="max-w-[794px] mx-auto flex flex-wrap gap-2 mb-4">
          <Button mono={false} variant="secondary" size="sm" disabled={c.isGenerating} onClick={() => void c.generate('shorten')}>Raccourcir</Button>
          <Button mono={false} variant="secondary" size="sm" disabled={c.isGenerating || !selection} onMouseDown={e => e.preventDefault()} onClick={() => void c.generate('rephrase', selection ?? undefined)}>Reformuler la sélection</Button>
          <span className="w-full text-xs text-gray-500">Sélectionnez un passage dans le document pour le reformuler.</span>
        </div>}
        {!c.letter ? <div className="max-w-[794px] mx-auto bg-white min-h-80 p-8 sm:p-14 border border-gray-200">
          <FileText className="w-6 h-6 text-gray-400 mb-5" /><h2 className="text-xl font-semibold">Une lettre pour cette offre</h2>
          <p className="text-sm text-gray-600 mt-3 max-w-md">Ajoutez votre motivation dans les réglages si vous le souhaitez. Vous pourrez modifier le texte directement ici.</p>
          {!isSidebarOpen && <Button className="mt-6" mono={false} loading={c.isGenerating} disabled={!c.ready || c.jobDescription.trim().length < MIN_OFFER_CHARS} onClick={() => void c.generate()}>Rédiger ma lettre</Button>}
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
