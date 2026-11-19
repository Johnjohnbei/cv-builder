import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { MIN_OFFER_CHARS, type CVData } from '@/src/shared/types';
import { getCVLanguage } from '@/src/lib/language-detection';
import { getUserErrorMessage } from '@/src/shared/lib/convex-error';
import { STORAGE_FAILED_MESSAGE, readStoredText, writeStoredText } from '@/src/shared/lib/storage';
import { COVER_LETTER_STORAGE_KEY, isStoredContextForOffer, parseStoredContext, getLetterLanguage, buildCoverLetterText, buildFilename, letterStorageKey, readApplicationDraft, type CoverLetterData, type StoredCoverLetterContext } from '../lib/cover-letter-drafts';

type Notify = (args: { message: string; type: 'success' | 'error' }) => void;
export interface UseCoverLetterDeps {
  cvData: CVData | null; jobDescription: string; cvId?: string;
  user: unknown; notify: Notify; accessCode?: string;
  /** The company the offer analysis read: the field is filled before any generation */
  company?: string;
}
export type LetterSelection = { field: keyof CoverLetterData; start: number; end: number };
export type UseCoverLetterResult = ReturnType<typeof useCoverLetter>;
const emptyDraft = (): StoredCoverLetterContext => ({ letter: null, companyName: '', motivation: '', tone: 'professionnel et engagé' });

/** One application context, shared with the CV; opening it never calls an AI action. */
export function useCoverLetter({ cvData, jobDescription, cvId, user, notify, accessCode, company }: UseCoverLetterDeps) {
  const generateAction = useAction(api.ai.generateCoverLetter);
  const saveMutation = useMutation(api.coverLetters.save);
  const [search, setSearch] = useSearchParams();
  const isOpen = search.get('document') === 'letter';
  const setDocument = (letter: boolean) => { if (letter === isOpen) return; setSearch(previous => { const next = new URLSearchParams(previous); if (letter) next.set('document', 'letter'); else next.delete('document'); return next; }); };
  const owner = (user as { id?: string } | null)?.id ?? 'guest';
  const key = letterStorageKey(owner, cvId, jobDescription);
  const [draft, setDraft] = useState<StoredCoverLetterContext>(emptyDraft);
  const [legacyDraft, setLegacyDraft] = useState<StoredCoverLetterContext | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [status, setStatus] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const history = draft.revisions ?? [];
  const inFlight = useRef(false);
  const saved = useQuery(api.coverLetters.forApplication, isOpen && user ? { cvId: cvId as Id<'cvs'> | undefined, jobDescription } : 'skip');
  const latest = useRef({ key, draft, cvId, jobDescription, user, cvData, loadedKey });
  latest.current = { key, draft, cvId, jobDescription, user, cvData, loadedKey };

  useEffect(() => {
    if (!isOpen || loadedKey === key || (user && saved === undefined)) return;
    const local = readApplicationDraft(key, jobDescription, !user);
    const remote: StoredCoverLetterContext | null = saved ? {
      letter: { subject: saved.subject, greeting: saved.greeting, body: saved.body, closing: saved.closing },
      revisions: saved.revisions, companyName: saved.companyName, companyStage: saved.companyStage, companyBusinessModel: saved.companyBusinessModel,
      writingSample: saved.writingSample, motivation: saved.motivation, tone: saved.tone, updatedAt: Date.parse(saved.createdAt), cvSnapshot: saved.cvSnapshot as CVData | undefined,
      jobDescription: saved.jobDescription,
    } : null;
    const chosen = local && (!remote || (local.updatedAt ?? 0) > (remote.updatedAt ?? 0)) ? local : remote ?? local;
    const legacy = parseStoredContext(readStoredText(COVER_LETTER_STORAGE_KEY));
    setLegacyDraft(!chosen?.letter && legacy?.letter && (legacy.jobDescription === undefined || isStoredContextForOffer(legacy, jobDescription)) ? legacy : null);
    // The company the offer names fills an empty field: a draft the user wrote is never overwritten
    const opened = chosen ?? emptyDraft();
    setDraft(!opened.companyName?.trim() && company ? { ...opened, companyName: company } : opened);
    setLoadedKey(key);
    setStatus(chosen === local && local?.letter && user ? 'pending' : 'saved');
  }, [isOpen, key, loadedKey, saved, jobDescription, user, company]);

  type Snapshot = typeof latest.current;
  const localSave = useCallback((current: Snapshot = latest.current) => {
    if (current.key !== current.loadedKey) return false;
    const context = { ...current.draft, jobDescription: current.jobDescription, cvSnapshot: current.cvData ?? undefined };
    const ok = writeStoredText(current.key, JSON.stringify(context));
    if (!ok) notify({ message: STORAGE_FAILED_MESSAGE, type: 'error' });
    return ok;
  }, [notify]);

  const saveSnapshot = useCallback(async (current: Snapshot) => {
    if (current.key !== current.loadedKey) return;
    const localOk = localSave(current);
    if ((latest.current.user as { id?: string } | null)?.id !== (current.user as { id?: string } | null)?.id) return;
    if (!current.user || !current.draft.letter) {
      if (latest.current.key === current.key) setStatus(localOk ? 'saved' : 'error');
      return;
    }
    if (latest.current.key === current.key) setStatus('saving');
    try {
      await saveMutation({ cvId: current.cvId as Id<'cvs'> | undefined, jobDescription: current.jobDescription,
        companyName: current.draft.companyName, companyStage: current.draft.companyStage,
        companyBusinessModel: current.draft.companyBusinessModel, writingSample: current.draft.writingSample, motivation: current.draft.motivation, tone: current.draft.tone,
        cvSnapshot: current.cvData ?? undefined, revisions: current.draft.revisions, ...current.draft.letter });
      if (latest.current.key === current.key && latest.current.draft === current.draft) setStatus('saved');
    } catch (error) {
      if (latest.current.key === current.key && latest.current.draft === current.draft) setStatus('error');
      notify({ message: getUserErrorMessage(error, 'Sauvegarde du compte impossible. Réessayez.'), type: 'error' });
    }
  }, [localSave, saveMutation, notify]);

  const save = useCallback(() => saveSnapshot(latest.current), [saveSnapshot]);
  const lastReady = useRef(latest.current);
  if (key === loadedKey) lastReady.current = latest.current;
  useEffect(() => {
    const activeKey = key;
    return () => { if (lastReady.current.key === activeKey) void saveSnapshot(lastReady.current); };
  }, [key, saveSnapshot]);

  useEffect(() => {
    if (status !== 'pending' || key !== loadedKey) return;
    const timer = window.setTimeout(() => { void save(); }, 700);
    return () => window.clearTimeout(timer);
  }, [draft, status, key, loadedKey, save]);
  useEffect(() => {
    const flush = () => { localSave(); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [localSave]);

  const change = (patch: Partial<StoredCoverLetterContext>) => {
    if (loadedKey !== key) return;
    setDraft(current => ({ ...current, ...patch, updatedAt: Date.now() }));
    setStatus('pending');
  };
  const lastEdit = useRef({ field: "", at: 0 });
  const updateLetterField = (field: keyof CoverLetterData, value: string) => {
    if (!draft.letter) return;
    const revisions = lastEdit.current.field !== field || Date.now() - lastEdit.current.at > 700 ? [...history.slice(-19), draft.letter] : history;
    lastEdit.current = { field, at: Date.now() };
    change({ letter: { ...draft.letter, [field]: value }, revisions });
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous || isGenerating) return;
    change({ letter: previous, revisions: history.slice(0, -1) });
    lastEdit.current = { field: "", at: 0 };
  };
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return;
      event.preventDefault(); undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, undo]);
  const generate = async (operation: 'generate' | 'shorten' | 'rephrase' = 'generate', selection?: LetterSelection) => {
    if (!cvData || jobDescription.trim().length < MIN_OFFER_CHARS || inFlight.current || loadedKey !== key) return;
    if (operation !== 'generate' && !draft.letter) return;
    if (operation === 'rephrase' && (!selection || selection.end <= selection.start)) return;
    const source = draft;
    const sourceKey = key;
    inFlight.current = true;
    setIsGenerating(true);
    try {
      const result = await generateAction({ cvData, jobDescription, companyName: draft.companyName || undefined,
        companyStage: draft.companyStage, companyBusinessModel: draft.companyBusinessModel,
        tone: draft.tone, motivation: draft.motivation, writingSample: draft.writingSample,
        language: operation !== 'generate' && draft.letter ? getLetterLanguage(draft.letter) : getCVLanguage(cvData), accessCode,
        operation, previous: operation === 'generate' ? undefined : draft.letter, selection });
      // A late response must never replace a different application or a newer manual edit.
      if (latest.current.key !== sourceKey || latest.current.draft !== source) {
        notify({ message: 'Le document a changé pendant la rédaction. Votre texte a été conservé.', type: 'error' });
        return;
      }
      const { subject, greeting, body, closing } = result;
      change({ letter: { subject, greeting, body, closing }, companyName: source.companyName || result.companyName, revisions: source.letter ? [...history.slice(-19), source.letter] : history });
      lastEdit.current = { field: "", at: 0 };
    } catch (error) {
      notify({ message: getUserErrorMessage(error, 'Rédaction impossible. Votre texte a été conservé.'), type: 'error' });
    } finally { inFlight.current = false; setIsGenerating(false); }
  };
  const copy = async () => {
    if (!draft.letter) return;
    try {
      await navigator.clipboard.writeText(buildCoverLetterText(draft.letter, cvData?.personal_info.name));
      notify({ message: 'Lettre copiée.', type: 'success' });
    } catch { notify({ message: 'Copie impossible. Utilisez Exporter en texte.', type: 'error' }); }
  };
  const download = () => {
    if (!draft.letter) return;
    const url = URL.createObjectURL(new Blob([buildCoverLetterText(draft.letter, cvData?.personal_info.name)], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = buildFilename(draft.companyName); anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportDocument = async (format: 'pdf' | 'docx') => {
    if (!draft.letter || !cvData || isExporting) return;
    setIsExporting(true);
    try {
      const { exportLetterToPdf, exportLetterToDocx } = await import('@/src/shared/lib/export-letter');
      const options = { letter: draft.letter, personalInfo: cvData.personal_info, companyName: draft.companyName, language: getLetterLanguage(draft.letter) };
      await (format === 'pdf' ? exportLetterToPdf(options) : exportLetterToDocx(options));
    } catch {
      notify({ message: 'Export impossible. Votre lettre reste disponible : réessayez ou utilisez Copier.', type: 'error' });
    } finally { setIsExporting(false); }
  };
  return {
    isOpen, open: () => setDocument(true), close: () => { void save(); setDocument(false); },
    isExporting, exportDocument,
    letterLanguage: draft.letter ? getLetterLanguage(draft.letter) : cvData ? getCVLanguage(cvData) : 'fr' as const,
    saveLabel: status === 'error' ? 'Sauvegarde à réessayer' : status === 'pending' || status === 'saving' ? 'Enregistrement…' : `Enregistré automatiquement ${user ? 'sur votre compte' : 'dans ce navigateur'}`,
    legacyDraftAvailable: Boolean(legacyDraft?.letter), importLegacyDraft: () => { if (legacyDraft) change(legacyDraft); setLegacyDraft(null); },
    ready: loadedKey === key, letter: loadedKey === key ? draft.letter : null,
    companyName: draft.companyName ?? '', setCompanyName: (value: string) => change({ companyName: value }),
    companyStage: draft.companyStage ?? '', setCompanyStage: (value: string) => change({ companyStage: value }),
    companyBusinessModel: draft.companyBusinessModel ?? '', setCompanyBusinessModel: (value: string) => change({ companyBusinessModel: value }),
    writingSample: draft.writingSample ?? '', setWritingSample: (value: string) => change({ writingSample: value }),
    motivation: draft.motivation ?? '', setMotivation: (value: string) => change({ motivation: value }),
    tone: draft.tone ?? 'professionnel et engagé', setTone: (value: string) => change({ tone: value }),
    storageLabel: user ? 'sur votre compte' : 'dans ce navigateur',
    jobDescription, isGenerating, status, save, generate, copy, download, updateLetterField, undo, canUndo: history.length > 0,
  };
}
