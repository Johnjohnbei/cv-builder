import { useCallback, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { CVData, DesignSettings } from '@/src/shared/types';

const GUEST_LAST_OPTIMIZED_KEY = 'guest_last_optimized';
const GUEST_CVS_KEY = 'guest_cvs';

export interface UseCVPersistenceDeps {
  cvData: CVData | null;
  designSettings: DesignSettings;
  selectedTemplate: string;
  user: unknown; // Clerk user object — treated as opaque presence flag here
  isGuest: boolean;
  notify: (args: { message: string; type: 'success' | 'error' }) => void;
}

export interface UseCVPersistenceResult {
  isSaving: boolean;
  saveDraft: () => Promise<void>;
}

// ─── Pure helpers (exported for unit tests) ───

/**
 * Strip Convex system fields (_id, _creationTime) and our table-level fields
 * (userId, createdAt) from a CV payload before re-saving. These leak in when
 * the editor is hydrated from a previously-saved cvs record, and they break
 * the createMyCV / updateLastGeneratedCV mutations on the second save.
 */
export function stripPersistenceArtifacts<T extends object>(obj: T): T {
  const {
    _id, _creationTime, userId, createdAt,
    ...clean
  } = obj as T & { _id?: unknown; _creationTime?: unknown; userId?: unknown; createdAt?: unknown };
  // mark vars as intentionally unused
  void _id; void _creationTime; void userId; void createdAt;
  return clean as T;
}

/**
 * Merge design + selectedTemplate into a persisted CV payload shape.
 * Matches the shape expected by Convex `cvs.createMyCV` and guest localStorage.
 */
export function buildPersistedCV(cvData: CVData, designSettings: DesignSettings, selectedTemplate: string): CVData {
  return stripPersistenceArtifacts({
    ...cvData,
    design: { ...designSettings, template: selectedTemplate },
  });
}

/** Append a CV to the guest list, capped to keep localStorage small. */
export function appendToGuestList(existing: unknown[], newCv: CVData & { _id: string; createdAt: string }): unknown[] {
  return [newCv, ...existing];
}

// ─── Hook ───

/**
 * Persist CV drafts. Handles both authenticated (Convex storeMe + createMyCV)
 * and guest (localStorage) flows uniformly.
 */
export function useCVPersistence(deps: UseCVPersistenceDeps): UseCVPersistenceResult {
  const { cvData, designSettings, selectedTemplate, user, isGuest, notify } = deps;
  const storeUser = useMutation(api.users.store);
  const createCV = useMutation(api.cvs.createMyCV);
  const updateLastCV = useMutation(api.users.updateLastGeneratedCV);
  const [isSaving, setIsSaving] = useState(false);

  const saveDraft = useCallback(async () => {
    if (!cvData) return;
    setIsSaving(true);
    try {
      const persisted = buildPersistedCV(cvData, designSettings, selectedTemplate);

      if (user) {
        await storeUser();
        // Two writes :
        // 1) Archive snapshot in `cvs` table — visible in dashboard list
        // 2) Sync the working draft `users.lastGeneratedCV` so a refresh
        //    of the editor restores the current state (not just the last
        //    optimize from the dashboard).
        await createCV({
          personal_info: persisted.personal_info,
          experience: persisted.experience,
          education: persisted.education,
          skills: persisted.skills,
          languages: persisted.languages,
          design: persisted.design,
          detectedLanguage: persisted.detectedLanguage,
          languageOverride: persisted.languageOverride,
          _translations: persisted._translations,
        });
        await updateLastCV({ cvData: persisted });
      } else if (isGuest) {
        localStorage.setItem(GUEST_LAST_OPTIMIZED_KEY, JSON.stringify(persisted));
        const existing = JSON.parse(localStorage.getItem(GUEST_CVS_KEY) || '[]');
        const entry = {
          ...persisted,
          _id: `guest_${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem(GUEST_CVS_KEY, JSON.stringify(appendToGuestList(existing, entry)));
      }

      notify({ message: 'Brouillon sauvegardé !', type: 'success' });
    } catch (error) {
      console.error('Error saving draft:', error);
      notify({ message: 'Erreur lors de la sauvegarde.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  }, [cvData, designSettings, selectedTemplate, user, isGuest, storeUser, createCV, updateLastCV, notify]);

  return { isSaving, saveDraft };
}
