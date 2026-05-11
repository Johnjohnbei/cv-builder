import { useCallback, useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { CVData } from '@/src/shared/types';
import { detectJobDescriptionLanguage } from '@/src/lib/languageDetection';

export interface CoverLetterData { subject: string; greeting: string; body: string; closing: string }
type Notify = (args: { message: string; type: 'success' | 'error' }) => void;

export interface UseCoverLetterDeps {
  cvData: CVData | null;
  jobDescription: string;
  isTailored: boolean;
  cvId?: string;
  user: unknown;
  notify: Notify;
  accessCode?: string;
}

export interface UseCoverLetterResult {
  isOpen: boolean; open: () => void; close: () => void;
  isTailored: boolean;
  companyName: string; setCompanyName: (v: string) => void;
  companyStage: string; setCompanyStage: (v: string) => void;
  companyBusinessModel: string; setCompanyBusinessModel: (v: string) => void;
  tone: string; setTone: (v: string) => void;
  localJobDescription: string; setLocalJobDescription: (v: string) => void;
  letter: CoverLetterData | null; setLetter: (l: CoverLetterData) => void;
  isGenerating: boolean; isSaving: boolean; isExtractingCompany: boolean;
  generate: () => Promise<void>; save: () => Promise<void>;
  copy: () => void; download: () => void;
}

// ─── Pure helpers (exported for tests) ───

/** Format a cover letter object into a plain-text block suitable for copy/download. */
export function buildCoverLetterText(letter: CoverLetterData, name?: string): string {
  const parts = [letter.greeting, letter.body, letter.closing];
  if (name && name.trim().length > 0) parts.push(name.trim());
  return parts.join('\n\n').replace(/\s+$/, '');
}

const slug = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Build a download filename for the cover letter. */
export function buildFilename(companyName?: string): string {
  if (!companyName || companyName.trim().length === 0) return 'lettre-motivation.txt';
  const slugged = slug(companyName);
  return slugged.length > 0 ? `lettre-${slugged}.txt` : 'lettre-motivation.txt';
}

/** User can only save if both signed in and a letter has been generated. */
export function canSave(user: unknown, letter: CoverLetterData | null): boolean {
  return Boolean(user) && letter !== null;
}

/** True when we should kick off auto-extraction of the company name on drawer open. */
export function shouldTriggerExtraction(companyName: string, jobDescription: string): boolean {
  return companyName.trim().length === 0 && jobDescription.trim().length >= 50;
}

const DEFAULT_TONE = 'professionnel et engagé';

/** Owns the inline cover letter drawer state for the editor. */
export function useCoverLetter(deps: UseCoverLetterDeps): UseCoverLetterResult {
  const { cvData, jobDescription, isTailored, cvId, user, notify, accessCode } = deps;
  const generateAction = useAction(api.ai.generateCoverLetter);
  const extractAction = useAction(api.ai.extractCompanyMeta);
  const saveMutation = useMutation(api.coverLetters.save);

  const [isOpen, setIsOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyStage, setCompanyStage] = useState('');
  const [companyBusinessModel, setCompanyBusinessModel] = useState('');
  const [tone, setTone] = useState(DEFAULT_TONE);
  const [localJobDescription, setLocalJobDescription] = useState('');
  const [letter, setLetter] = useState<CoverLetterData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtractingCompany, setIsExtractingCompany] = useState(false);

  const open = useCallback(() => {
    const jd = localJobDescription.length > 0 ? localJobDescription : jobDescription;
    setLocalJobDescription(prev => (prev.length > 0 ? prev : jobDescription));
    setIsOpen(true);
    if (!shouldTriggerExtraction(companyName, jd)) return;
    setIsExtractingCompany(true);
    extractAction({ jobDescription: jd, accessCode })
      .then(r => {
        if (r?.companyName) setCompanyName(curr => (curr.trim().length === 0 ? r.companyName! : curr));
        if (r?.stage) setCompanyStage(curr => (curr.trim().length === 0 ? r.stage! : curr));
        if (r?.businessModel) setCompanyBusinessModel(curr => (curr.trim().length === 0 ? r.businessModel! : curr));
      })
      .catch(e => { console.warn('[useCoverLetter] extract failed:', e); })
      .finally(() => setIsExtractingCompany(false));
  }, [jobDescription, localJobDescription, companyName, accessCode, extractAction]);
  const close = useCallback(() => setIsOpen(false), []);

  const generate = useCallback(async () => {
    if (!cvData || localJobDescription.length < 50) return;
    setIsGenerating(true);
    try {
      const language = detectJobDescriptionLanguage(localJobDescription);
      const result = await generateAction({
        cvData, jobDescription: localJobDescription,
        companyName: companyName || undefined,
        companyStage: companyStage || undefined,
        companyBusinessModel: companyBusinessModel || undefined,
        tone, language, accessCode,
      });
      setLetter(result);
    } catch (e) {
      console.error('Error generating cover letter:', e);
      notify({ message: 'Erreur lors de la génération. Réessayez.', type: 'error' });
    } finally { setIsGenerating(false); }
  }, [cvData, localJobDescription, companyName, companyStage, companyBusinessModel, tone, accessCode, generateAction, notify]);

  const save = useCallback(async () => {
    if (!canSave(user, letter) || !letter) return;
    setIsSaving(true);
    try {
      await saveMutation({
        cvId: cvId ? (cvId as Id<'cvs'>) : undefined,
        jobDescription: localJobDescription,
        companyName: companyName || undefined,
        ...letter,
      });
      notify({ message: 'Lettre sauvegardée !', type: 'success' });
    } catch (e) {
      console.error('Error saving cover letter:', e);
      notify({ message: 'Erreur lors de la sauvegarde.', type: 'error' });
    } finally { setIsSaving(false); }
  }, [user, letter, cvId, localJobDescription, companyName, saveMutation, notify]);

  const copy = useCallback(() => {
    if (!letter) return;
    navigator.clipboard.writeText(buildCoverLetterText(letter, cvData?.personal_info?.name));
    notify({ message: 'Copié dans le presse-papier !', type: 'success' });
  }, [letter, cvData, notify]);

  const download = useCallback(() => {
    if (!letter) return;
    const text = buildCoverLetterText(letter, cvData?.personal_info?.name);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildFilename(companyName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [letter, cvData, companyName]);

  return {
    isOpen, open, close, isTailored,
    companyName, setCompanyName,
    companyStage, setCompanyStage,
    companyBusinessModel, setCompanyBusinessModel,
    tone, setTone,
    localJobDescription, setLocalJobDescription, letter, setLetter,
    isGenerating, isSaving, isExtractingCompany, generate, save, copy, download,
  };
}
