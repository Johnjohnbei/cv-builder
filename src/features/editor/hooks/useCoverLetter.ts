import { useCallback, useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { CVData } from '@/src/shared/types';

export interface CoverLetterData { subject: string; greeting: string; body: string; closing: string }
type Notify = (args: { message: string; type: 'success' | 'error' }) => void;

export interface UseCoverLetterDeps {
  cvData: CVData | null;
  jobDescription: string;
  cvId?: string;
  user: unknown;
  notify: Notify;
  accessCode?: string;
}

export interface UseCoverLetterResult {
  isOpen: boolean; open: () => void; close: () => void;
  companyName: string; setCompanyName: (v: string) => void;
  tone: string; setTone: (v: string) => void;
  localJobDescription: string; setLocalJobDescription: (v: string) => void;
  letter: CoverLetterData | null; setLetter: (l: CoverLetterData) => void;
  isGenerating: boolean; isSaving: boolean;
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

const DEFAULT_TONE = 'professionnel et engagé';

/** Owns the inline cover letter drawer state for the editor. */
export function useCoverLetter(deps: UseCoverLetterDeps): UseCoverLetterResult {
  const { cvData, jobDescription, cvId, user, notify, accessCode } = deps;
  const generateAction = useAction(api.ai.generateCoverLetter);
  const saveMutation = useMutation(api.coverLetters.save);

  const [isOpen, setIsOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [tone, setTone] = useState(DEFAULT_TONE);
  const [localJobDescription, setLocalJobDescription] = useState('');
  const [letter, setLetter] = useState<CoverLetterData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const open = useCallback(() => {
    setLocalJobDescription(prev => (prev.length > 0 ? prev : jobDescription));
    setIsOpen(true);
  }, [jobDescription]);
  const close = useCallback(() => setIsOpen(false), []);

  const generate = useCallback(async () => {
    if (!cvData || localJobDescription.length < 50) return;
    setIsGenerating(true);
    try {
      const result = await generateAction({
        cvData, jobDescription: localJobDescription,
        companyName: companyName || undefined, tone, accessCode,
      });
      setLetter(result);
    } catch (e) {
      console.error('Error generating cover letter:', e);
      notify({ message: 'Erreur lors de la génération. Réessayez.', type: 'error' });
    } finally { setIsGenerating(false); }
  }, [cvData, localJobDescription, companyName, tone, accessCode, generateAction, notify]);

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
    isOpen, open, close,
    companyName, setCompanyName,
    tone, setTone,
    localJobDescription, setLocalJobDescription,
    letter, setLetter,
    isGenerating, isSaving,
    generate, save, copy, download,
  };
}
