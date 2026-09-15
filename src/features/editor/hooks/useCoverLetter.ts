import { useCallback, useEffect, useRef, useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { CVData } from '@/src/shared/types';
import { detectJobDescriptionLanguage, detectTextLanguage } from '@/src/lib/languageDetection';
import { getUserErrorMessage } from '@/src/shared/lib/convexError';
import { STORAGE_FAILED_MESSAGE, writeStoredText } from '@/src/shared/lib/storage';
import { stripAccents } from '@/src/shared/lib/text';

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
  /** True only when the CV was tailored AND the drawer's JD is still the JD it was tailored for. */
  isTailoredForLocalJD: boolean;
  cvId?: string;
  companyName: string; setCompanyName: (v: string) => void;
  companyStage: string; setCompanyStage: (v: string) => void;
  companyBusinessModel: string; setCompanyBusinessModel: (v: string) => void;
  tone: string; setTone: (v: string) => void;
  localJobDescription: string; setLocalJobDescription: (v: string) => void;
  /** True when the user edited the drawer JD and the editor's JD has since diverged. */
  jdOutOfSync: boolean;
  /** Replace the drawer JD with the editor's current JD. */
  syncJobDescription: () => void;
  letter: CoverLetterData | null;
  /**
   * A mirrored letter that belongs to a DIFFERENT offer than the one open.
   * Never restored automatically — the drawer offers to load it explicitly, so
   * the work is not lost and not passed off as current either.
   */
  staleStoredLetter: CoverLetterData | null;
  /** Programmatic load (restore, reload saved). Does NOT mark manual edits. */
  setLetter: (l: CoverLetterData) => void;
  /** Manual field edit from the UI. Marks the letter as dirty. */
  updateLetterField: (field: keyof CoverLetterData, value: string) => void;
  isGenerating: boolean; isSaving: boolean; isExtractingCompany: boolean;
  generate: () => Promise<void>; save: () => Promise<void>;
  copy: () => void; download: () => void;
}

// ─── Pure helpers (exported for tests) ───

/**
 * The language the letter is written in. It follows the offer and can differ
 * from the CV's: an English letter for a French CV used to be exported with
 * "Objet :" and "Paris, le 15 septembre 2026".
 */
export function getLetterLanguage(letter: CoverLetterData): 'fr' | 'en' {
  return detectTextLanguage([letter.subject, letter.greeting, letter.body, letter.closing].join('\n'));
}

/**
 * Format a cover letter into a plain-text block suitable for copy/download.
 *
 * The subject line leads, as it does in the .docx export: a letter pasted into
 * an email without its "Objet" forces the user back into the drawer to grab it
 * separately, which is the whole point of a one-click copy.
 */
export function buildCoverLetterText(
  letter: CoverLetterData,
  name?: string,
  language: 'fr' | 'en' = getLetterLanguage(letter),
): string {
  const parts: string[] = [];
  if (letter.subject?.trim()) parts.push(`${language === 'en' ? 'Subject: ' : 'Objet : '}${letter.subject.trim()}`);
  parts.push(letter.greeting, letter.body, letter.closing);
  if (name && name.trim().length > 0) parts.push(name.trim());
  return parts.join('\n\n').replace(/\s+$/, '');
}

const slug = (s: string): string =>
  stripAccents(s).toLowerCase()
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

/** localStorage mirror of the drawer context (survives drawer close, guest or signed in). */
export const COVER_LETTER_STORAGE_KEY = 'guest_last_cover_letter';

/** Drawer context mirrored to localStorage: the letter plus the company metadata already known. */
export interface StoredCoverLetterContext {
  letter: CoverLetterData | null;
  companyName?: string;
  companyStage?: string;
  companyBusinessModel?: string;
  jobDescription?: string;
}

const asText = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined;

function parseLetterShape(v: unknown): CoverLetterData | null {
  if (v === null || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  if (
    typeof p.subject === 'string' && typeof p.greeting === 'string' &&
    typeof p.body === 'string' && typeof p.closing === 'string'
  ) {
    return { subject: p.subject, greeting: p.greeting, body: p.body, closing: p.closing };
  }
  return null;
}

/**
 * Parse the mirrored drawer context. Returns null only when nothing usable is stored.
 * Backward compatible: a legacy value holding the bare letter fields at the top level is
 * read as a context whose letter is that value and whose metadata is absent.
 */
export function parseStoredContext(raw: string | null): StoredCoverLetterContext | null {
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (parsed === null || typeof parsed !== 'object') return null;
  const p = parsed as Record<string, unknown>;
  return {
    letter: parseLetterShape(p) ?? parseLetterShape(p.letter),
    companyName: asText(p.companyName),
    companyStage: asText(p.companyStage),
    companyBusinessModel: asText(p.companyBusinessModel),
    jobDescription: asText(p.jobDescription),
  };
}

/** Parse a mirrored letter from localStorage. Returns null on any invalid shape. */
export function parseStoredLetter(raw: string | null): CoverLetterData | null {
  return parseStoredContext(raw)?.letter ?? null;
}

/** Most recent saved letter for a given cvId (input list is ordered most-recent first). */
export function findLatestSavedForCv<T extends { cvId?: string }>(
  letters: readonly T[] | undefined,
  cvId: string | undefined,
): T | null {
  if (!letters || !cvId) return null;
  return letters.find((l) => l.cvId === cvId) ?? null;
}

/**
 * Does a mirrored context belong to the offer currently open?
 *
 * A stored context with no jobDescription predates that field: nothing can be
 * compared, so it is treated as belonging rather than silently discarded. It
 * self-heals on the next write, which always records the offer.
 */
export function isStoredContextForOffer(
  stored: StoredCoverLetterContext | null,
  currentJobDescription: string,
): boolean {
  if (!stored) return false;
  if (stored.jobDescription === undefined) return true;
  return stored.jobDescription.trim() === currentJobDescription.trim();
}

/**
 * Is a mirrored LETTER still usable for the offer currently open?
 *
 * The mirror exists so closing the drawer never loses work, but a letter is
 * written FOR one job description. Restoring it against another offer showed
 * the user a letter that argued for a different position — the bug reported on
 * 2026-08-17.
 *
 * Deliberately narrower than isStoredContextForOffer: the company metadata is
 * worth restoring even when no letter was ever generated, which is what spares
 * a redundant extraction call. Conflating the two made the company name vanish
 * and fired that call again — caught by the e2e hermeticity guard.
 */
export function isStoredLetterRelevant(
  stored: StoredCoverLetterContext | null,
  currentJobDescription: string,
): boolean {
  return Boolean(stored?.letter) && isStoredContextForOffer(stored, currentJobDescription);
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
  const [localJobDescription, setLocalJobDescriptionRaw] = useState('');
  const [userEditedJD, setUserEditedJD] = useState(false);
  const [letter, setLetterRaw] = useState<CoverLetterData | null>(null);
  const [staleStoredLetter, setStaleStoredLetter] = useState<CoverLetterData | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtractingCompany, setIsExtractingCompany] = useState(false);

  // ─── Company extraction guards: remember the JD already extracted + in-flight flag ───
  const extractedJDRef = useRef<string | null>(null);
  const extractInFlightRef = useRef(false);

  // ─── Mirror letter + company context to localStorage (guest AND signed in) ───
  // Gated on isOpen: before the first open() the state is still empty and would
  // overwrite the stored context that open() is about to restore.
  // For a guest this mirror is the only copy of a paid letter: a refused write
  // is said once (not at every keystroke), instead of being swallowed.
  const mirrorFailedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) return;
    const saved = writeStoredText(COVER_LETTER_STORAGE_KEY, JSON.stringify({
      letter, companyName, companyStage, companyBusinessModel,
      jobDescription: localJobDescription,
    }));
    if (!saved && !user && !mirrorFailedRef.current) notify({ message: STORAGE_FAILED_MESSAGE, type: 'error' });
    mirrorFailedRef.current = !saved;
  }, [isOpen, letter, companyName, companyStage, companyBusinessModel, localJobDescription, user, notify]);

  // ─── Resync the drawer JD when the editor JD changes and the user hasn't typed in it ───
  const prevPropJDRef = useRef(jobDescription);
  useEffect(() => {
    if (jobDescription === prevPropJDRef.current) return;
    prevPropJDRef.current = jobDescription;
    if (!userEditedJD) setLocalJobDescriptionRaw(jobDescription);
  }, [jobDescription, userEditedJD]);

  const setLocalJobDescription = useCallback((v: string) => {
    setUserEditedJD(true);
    setLocalJobDescriptionRaw(v);
  }, []);

  const jdOutOfSync =
    userEditedJD && jobDescription.trim().length > 0 && jobDescription !== localJobDescription;

  const syncJobDescription = useCallback(() => {
    setLocalJobDescriptionRaw(jobDescription);
    setUserEditedJD(false);
  }, [jobDescription]);

  const isTailoredForLocalJD = isTailored && localJobDescription.trim() === jobDescription.trim();

  const open = useCallback(() => {
    // Restore the whole drawer context so closing never loses work, and so an
    // already known company never triggers a second extraction.
    let stored: StoredCoverLetterContext | null = null;
    try { stored = parseStoredContext(localStorage.getItem(COVER_LETTER_STORAGE_KEY)); }
    catch { /* storage unavailable */ }

    const jd = localJobDescription.length > 0 ? localJobDescription
      : (jobDescription.length > 0 ? jobDescription : stored?.jobDescription ?? '');
    setLocalJobDescriptionRaw(prev => (prev.length > 0 ? prev : jd));

    // A mirrored context belongs to the offer it was written for. Reusing its
    // letter — or its company metadata — against another offer produced a
    // letter arguing for a different position, and addressed to the wrong
    // company. Both are gated on the same check.
    const sameOffer = isStoredContextForOffer(stored, jd);
    const letterUsable = isStoredLetterRelevant(stored, jd);
    const company = companyName.trim().length === 0 && sameOffer && stored?.companyName
      ? stored.companyName : companyName;
    if (stored) {
      if (!letter && stored.letter) setStaleStoredLetter(letterUsable ? null : stored.letter);
      if (letterUsable && !letter) setLetterRaw(stored.letter);
      if (company !== companyName) setCompanyName(company);
      if (sameOffer) {
        const { companyStage: stage, companyBusinessModel: model } = stored;
        if (stage) setCompanyStage(curr => (curr.trim().length === 0 ? stage : curr));
        if (model) setCompanyBusinessModel(curr => (curr.trim().length === 0 ? model : curr));
      }
    }
    setIsOpen(true);
    if (!shouldTriggerExtraction(company, jd)) return;
    // Skip if the same JD was already extracted, or a call is already running
    if (extractInFlightRef.current || extractedJDRef.current === jd) return;
    extractInFlightRef.current = true;
    setIsExtractingCompany(true);
    extractAction({ jobDescription: jd, accessCode })
      .then(r => {
        extractedJDRef.current = jd;
        if (r?.companyName) setCompanyName(curr => (curr.trim().length === 0 ? r.companyName! : curr));
        if (r?.stage) setCompanyStage(curr => (curr.trim().length === 0 ? r.stage! : curr));
        if (r?.businessModel) setCompanyBusinessModel(curr => (curr.trim().length === 0 ? r.businessModel! : curr));
      })
      .catch(e => { console.warn('[useCoverLetter] extract failed:', e); })
      .finally(() => {
        extractInFlightRef.current = false;
        setIsExtractingCompany(false);
      });
  }, [jobDescription, localJobDescription, companyName, letter, accessCode, extractAction]);
  const close = useCallback(() => setIsOpen(false), []);

  const setLetter = useCallback((l: CoverLetterData) => {
    setLetterRaw(l);
    setStaleStoredLetter(null);
  }, []);

  const updateLetterField = useCallback((field: keyof CoverLetterData, value: string) => {
    setIsDirty(true);
    setLetterRaw(curr => (curr ? { ...curr, [field]: value } : curr));
  }, []);

  const generate = useCallback(async () => {
    if (!cvData || localJobDescription.length < 50) return;
    if (isDirty && letter) {
      const confirmed = window.confirm('Régénérer va remplacer vos modifications manuelles. Continuer ?');
      if (!confirmed) return;
    }
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
      setLetterRaw(result);
      setIsDirty(false);
    } catch (e) {
      console.error('Error generating cover letter:', e);
      notify({ message: getUserErrorMessage(e, 'Erreur lors de la génération. Réessayez.'), type: 'error' });
    } finally { setIsGenerating(false); }
  }, [cvData, localJobDescription, companyName, companyStage, companyBusinessModel, tone, accessCode, generateAction, notify, isDirty, letter]);

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
      setIsDirty(false);
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
    isOpen, open, close, isTailored, isTailoredForLocalJD, cvId,
    companyName, setCompanyName,
    companyStage, setCompanyStage,
    companyBusinessModel, setCompanyBusinessModel,
    tone, setTone,
    localJobDescription, setLocalJobDescription,
    jdOutOfSync, syncJobDescription,
    letter, staleStoredLetter, setLetter, updateLetterField,
    isGenerating, isSaving, isExtractingCompany, generate, save, copy, download,
  };
}
