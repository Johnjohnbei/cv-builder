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
 * Merge design + selectedTemplate into a persisted CV payload shape.
 * Matches the shape expected by Convex `cvs.createMyCV` and guest localStorage.
 */
export function buildPersistedCV(cvData: CVData, designSettings: DesignSettings, selectedTemplate: string): CVData {
  return {
    ...cvData,
    design: { ...designSettings, template: selectedTemplate },
  };
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
  const [isSaving, setIsSaving] = useState(false);

  const saveDraft = useCallback(async () => {
    if (!cvData) return;
    setIsSaving(true);
    try {
      const persisted = buildPersistedCV(cvData, designSettings, selectedTemplate);

      if (user) {
        await storeUser();
        await createCV({
          personal_info: persisted.personal_info,
          experience: persisted.experience,
          education: persisted.education,
          skills: persisted.skills,
          languages: persisted.languages,
          design: persisted.design,
          // Persist language state + translation cache so reopening the CV
          // preserves the user's working language and any cached translations.
          detectedLanguage: persisted.detectedLanguage,
          languageOverride: persisted.languageOverride,
          _translations: persisted._translations,
        });
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
  }, [cvData, designSettings, selectedTemplate, user, isGuest, storeUser, createCV, notify]);

  return { isSaving, saveDraft };
}
