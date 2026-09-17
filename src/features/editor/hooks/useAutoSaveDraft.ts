import { useEffect, useRef, useState } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import { stripPersistenceArtifacts } from './useCVPersistence';
import { writeStoredTexts } from '@/src/shared/lib/storage';

const DEBOUNCE_MS = 1500;

export interface UseAutoSaveDraftDeps {
  cvData: CVData | null;
  designSettings: DesignSettings;
  selectedTemplate: string;
  jobDescription: string;
  user: unknown;
  isGuest: boolean;
  updateLastCV: (args: { cvData: CVData; jobDescription?: string }) => Promise<unknown>;
  /**
   * True while the fit to pages condenses: its intermediate CVs are never
   * saved. Saved, a reload in the middle kept a half-fitted CV that the fit
   * never took up again (it only runs on a CV no role of which has a mode).
   */
  paused?: boolean;
}

export interface UseAutoSaveDraftResult {
  isAutoSaving: boolean;
  lastAutoSaveAt: Date | null;
  /** The last save attempt failed (network, session, or browser storage full) */
  saveFailed: boolean;
}

/**
 * Debounced auto-save of the working draft.
 *
 * Persists displayMode toggles, text edits, template changes and any other
 * mutation of cvData / designSettings / selectedTemplate after 1.5s of idle.
 * Major actions (translate, optimize, enrich, save-draft) call updateLastCV
 * synchronously and rely on this to cover the long tail of low-level edits.
 *
 * Guests mirror to localStorage so a refresh doesn't lose their work.
 *
 * The guard is "has cvData changed since hydration", NOT an explicit dirty
 * flag: the flag version required every one of the ~56 setCvData call sites in
 * the sidebar to remember to raise it, and all but three had forgotten — name,
 * title, email, education, skills, languages and summary edits rendered on
 * screen but were never persisted. Detecting the change here fixes every
 * caller at once and cannot be forgotten by a new one.
 */
export function useAutoSaveDraft(deps: UseAutoSaveDraftDeps): UseAutoSaveDraftResult {
  const {
    cvData, designSettings, selectedTemplate, jobDescription,
    user, isGuest, updateLastCV, paused = false,
  } = deps;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The save the debounce is waiting to run, if any */
  const pendingSaveRef = useRef<(() => void) | null>(null);
  /** False until the first non-null cvData has been seen (the hydration) */
  const hydratedRef = useRef(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<Date | null>(null);
  // A failed save only warned in the console while the header kept showing
  // the previous "Enregistré à", so the user believed the edits were kept.
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if ((!user && !isGuest) || !cvData) {
      // Nowhere to save to any more (a session that expired): the save queued
      // before must not run on exit, it would only be rejected.
      pendingSaveRef.current = null;
      return;
    }
    // First non-null cvData is the document we just loaded — saving it would
    // only write it back to itself.
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    // The state reached once the pause ends is saved then (paused is a dependency).
    // A save still pending holds the state before the pause: kept for the exit flush.
    if (paused) return;
    const save = () => {
      pendingSaveRef.current = null;
      const merged = stripPersistenceArtifacts({
        ...cvData,
        design: { ...designSettings, template: selectedTemplate },
      });
      if (user) {
        setIsAutoSaving(true);
        // The offer is always sent, "" included: the server keeps the stored
        // offer only when the field is omitted.
        updateLastCV({ cvData: merged, jobDescription })
          .then(() => {
            setLastAutoSaveAt(new Date());
            setSaveFailed(false);
          })
          .catch((e) => {
            console.warn('[auto-save] failed:', e);
            setSaveFailed(true);
          })
          .finally(() => setIsAutoSaving(false));
      } else {
        // The offer too: only the dashboard wrote it, so an offer changed in the
        // editor came back as the old one on reload, next to a CV tailored to the new.
        const saved = writeStoredTexts([
          ['guest_last_optimized', JSON.stringify(merged)],
          ['guest_last_jd', jobDescription],
        ]);
        if (saved) setLastAutoSaveAt(new Date());
        setSaveFailed(!saved);
      }
    };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pendingSaveRef.current = save;
    debounceRef.current = setTimeout(save, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [cvData, designSettings, selectedTemplate, jobDescription, user, isGuest, updateLastCV, paused]);

  // Leaving the editor or closing the tab inside the debounce window used to
  // drop the last edits: the cleanup cancelled the timer and nothing ran it.
  // Run the pending save instead. The guest mirror is synchronous; the account
  // mutation is best effort on tab close, reliable on in-app navigation.
  useEffect(() => {
    const flush = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      pendingSaveRef.current?.();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  return { isAutoSaving, lastAutoSaveAt, saveFailed };
}
