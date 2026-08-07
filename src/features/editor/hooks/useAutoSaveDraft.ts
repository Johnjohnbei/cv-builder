import { useEffect, useRef, useState } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import { stripPersistenceArtifacts } from './useCVPersistence';

const DEBOUNCE_MS = 1500;

export interface UseAutoSaveDraftDeps {
  cvData: CVData | null;
  designSettings: DesignSettings;
  selectedTemplate: string;
  jobDescription: string;
  user: unknown;
  isGuest: boolean;
  /** True once the user has actually edited something (guards initial hydration) */
  userModified: boolean;
  updateLastCV: (args: { cvData: CVData; jobDescription?: string }) => Promise<unknown>;
}

export interface UseAutoSaveDraftResult {
  isAutoSaving: boolean;
  lastAutoSaveAt: Date | null;
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
 * Guarded by `userModified` so the initial hydration doesn't write back to itself.
 */
export function useAutoSaveDraft(deps: UseAutoSaveDraftDeps): UseAutoSaveDraftResult {
  const {
    cvData, designSettings, selectedTemplate, jobDescription,
    user, isGuest, userModified, updateLastCV,
  } = deps;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<Date | null>(null);

  useEffect(() => {
    if ((!user && !isGuest) || !cvData || !userModified) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const merged = stripPersistenceArtifacts({
        ...cvData,
        design: { ...designSettings, template: selectedTemplate },
      });
      if (user) {
        setIsAutoSaving(true);
        updateLastCV({ cvData: merged, jobDescription: jobDescription || undefined })
          .then(() => setLastAutoSaveAt(new Date()))
          .catch((e) => console.warn('[auto-save] failed:', e))
          .finally(() => setIsAutoSaving(false));
      } else {
        localStorage.setItem('guest_last_optimized', JSON.stringify(merged));
        setLastAutoSaveAt(new Date());
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [cvData, designSettings, selectedTemplate, jobDescription, user, isGuest, userModified, updateLastCV]);

  return { isAutoSaving, lastAutoSaveAt };
}
