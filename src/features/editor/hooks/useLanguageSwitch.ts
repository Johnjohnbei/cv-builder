import { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { omitUserOwnedFields, pickUserOwnedFields, type CVData } from '@/src/shared/types';
import { getCVLanguage } from '@/src/lib/languageDetection';
import { contentSnapshot } from '@/src/lib/bilingual';
import { getUserErrorMessage } from '@/src/shared/lib/convexError';
import { STORAGE_FAILED_MESSAGE, writeStoredText } from '@/src/shared/lib/storage';

type Notify = (args: { message: string; type: 'success' | 'error' }) => void;

export interface UseLanguageSwitchDeps {
  cvData: CVData | null;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  user: unknown;
  isGuest: boolean;
  jobDescription: string;
  updateLastCV: (args: { cvData: CVData; jobDescription?: string }) => Promise<unknown>;
  notify: Notify;
  accessCode?: string;
}

export interface UseLanguageSwitchResult {
  /** Single source of truth for the displayed language, derived from cvData. */
  currentLanguage: 'fr' | 'en';
  /** Language awaiting confirmation in the regenerate modal (null = no modal). */
  pendingLanguage: 'fr' | 'en' | null;
  isRegenerating: boolean;
  handleLanguageChange: (lang: 'fr' | 'en') => void;
  handleConfirmRegenerate: () => Promise<void>;
  handleSwitchLabelsOnly: () => void;
  handleCancelLanguageChange: () => void;
}

/** Owns the FR/EN switch: cache-hit instant swap, LLM translation, labels-only override. */
export function useLanguageSwitch(deps: UseLanguageSwitchDeps): UseLanguageSwitchResult {
  const { cvData, setCvData, user, isGuest, jobDescription, updateLastCV, notify, accessCode } = deps;
  const translateCVAction = useAction(api.ai.translateCV);

  const [pendingLanguage, setPendingLanguage] = useState<'fr' | 'en' | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // ─── Language: single source of truth derived from cvData ───
  const currentLanguage: 'fr' | 'en' = cvData ? getCVLanguage(cvData) : 'fr';

  /** Optimistic persistence of the working draft (account) / mirror (guest). */
  const persist = (updated: CVData, label: string) => {
    if (user) {
      updateLastCV({ cvData: updated, jobDescription })
        .catch(e => console.warn(`[${label}] persist failed:`, e));
    } else if (isGuest) {
      if (!writeStoredText('guest_last_optimized', JSON.stringify(updated))) {
        notify({ message: STORAGE_FAILED_MESSAGE, type: 'error' });
      }
    }
  };

  const applyLanguageOverride = (lang: 'fr' | 'en') => {
    setCvData(prev => prev ? { ...prev, languageOverride: lang } : prev);
  };

  // Instant swap to a language we already have cached (no LLM, no modal).
  // Snapshots the current view under its own language first, so toggling back
  // is also instant and preserves in-view edits.
  const applyCachedLanguage = (target: 'fr' | 'en') => {
    if (!cvData) return;
    const cached = cvData._translations?.[target];
    if (!cached) return;
    const currentLang = getCVLanguage(cvData);
    const updated = {
      ...cvData,
      ...cached,
      // Photo and portfolio are the current ones, never the snapshot's (older
      // caches still carry them)
      personal_info: { ...omitUserOwnedFields(cached.personal_info), ...pickUserOwnedFields(cvData.personal_info) },
      _translations: { ...cvData._translations, [currentLang]: contentSnapshot(cvData) },
      detectedLanguage: target,
      languageOverride: target,
    };
    setCvData(updated);
    persist(updated, 'applyCachedLanguage');
    notify({
      message: target === 'en' ? 'Version anglaise (instantané)' : 'Version française (instantané)',
      type: 'success',
    });
  };

  const handleLanguageChange = (lang: 'fr' | 'en') => {
    if (!cvData || lang === currentLanguage) return;
    // Cache hit → instant swap. We NEVER re-detect the content language with
    // franc to decide the flag is "already right": on mixed content franc lies
    // and the old code flipped the flag without translating, freezing the mix.
    if (cvData._translations?.[lang]) {
      applyCachedLanguage(lang);
      return;
    }
    // No cached version → confirm a real translation (LLM call).
    setPendingLanguage(lang);
  };

  const handleConfirmRegenerate = async () => {
    if (!cvData || !pendingLanguage) return;
    const currentLang = getCVLanguage(cvData);

    // Snapshot of the current view content (photo excluded, cf. contentSnapshot).
    // Cached under the current language so toggling back is free.
    const currentSnapshot = contentSnapshot(cvData);

    // Defensive: if a cache appeared meanwhile, swap instantly instead of
    // burning an LLM call (handleLanguageChange normally catches this first).
    if (cvData._translations?.[pendingLanguage]) {
      applyCachedLanguage(pendingLanguage);
      setPendingLanguage(null);
      return;
    }

    // SLOW PATH: first time translating to this language → call LLM, cache
    // both directions so the next toggle is free.
    setIsRegenerating(true);
    try {
      const translatedData = await translateCVAction({
        cvData,
        targetLanguage: pendingLanguage,
        accessCode,
      });
      const translatedSnapshot = contentSnapshot(translatedData);
      // translateCV puts the photo and portfolio back itself: they never reach the model
      const updated = {
        ...translatedData,
        _translations: {
          ...cvData._translations,
          [currentLang]: currentSnapshot,
          [pendingLanguage]: translatedSnapshot,
        },
        detectedLanguage: pendingLanguage,
        languageOverride: pendingLanguage,
      };
      setCvData(updated);
      // Persist the new translation + cache to the working draft so a refresh
      // doesn't lose the work. Optimistic: don't block UI on the mutation.
      persist(updated, 'handleConfirmRegenerate slow-path');
      notify({ message: 'CV traduit ! Vous pouvez désormais basculer entre les langues instantanément.', type: 'success' });
      setPendingLanguage(null);
    } catch (error) {
      console.error('Error translating CV:', error);
      notify({ message: getUserErrorMessage(error, 'Erreur lors de la traduction du CV.'), type: 'error' });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSwitchLabelsOnly = () => {
    if (!pendingLanguage) return;
    applyLanguageOverride(pendingLanguage);
    setPendingLanguage(null);
  };

  const handleCancelLanguageChange = () => {
    setPendingLanguage(null);
  };

  return {
    currentLanguage,
    pendingLanguage,
    isRegenerating,
    handleLanguageChange,
    handleConfirmRegenerate,
    handleSwitchLabelsOnly,
    handleCancelLanguageChange,
  };
}
