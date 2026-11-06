import { useState, useEffect, useRef } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import { DEFAULT_DESIGN } from '@/src/shared/types';
import { stripPersistenceArtifacts } from './useCVPersistence';
import { readStoredJSON, readStoredText } from '@/src/shared/lib/storage';
import { migratedDesign } from '../lib/pagination/template-layouts';
import { autoCorrect } from '../lib/auto-corrections';
import { detectCVLanguage } from '@/src/lib/language-detection';

interface CVLoaderResult {
  cvData: CVData | null;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  designSettings: DesignSettings;
  setDesignSettings: React.Dispatch<React.SetStateAction<DesignSettings>>;
  selectedTemplate: string;
  setSelectedTemplate: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
  loadedJobDescription: string;
  /** What the code corrected by itself on the CV it loaded, in French, to be shown once */
  corrections: string[];
}

/** What the editor reads of the signed-in account: its working draft and the offer that draft was tailored to */
export interface EditorAccountData {
  lastGeneratedCV?: unknown;
  lastJobDescription?: string;
}

/** Where the editor takes the CV it opens on */
export type CVSource = 'wait' | 'account' | 'guest' | 'none';

/**
 * Which stored CV the editor must load. A signed-in user reads the account and
 * nothing else: falling through to the guest copy while the account query was
 * still loading, or because the tab still carried a guest flag, opened another
 * session's CV, which the auto-save then wrote into this account's own draft.
 * The dashboard already branches on the user alone (DashboardPage), the editor
 * did not. `none` is a visitor with neither an account nor guest access: there
 * is nothing to load, and nothing to wait for either.
 */
export function cvSourceOf(isSignedIn: boolean, accountAnswered: boolean, isGuest: boolean): CVSource {
  if (isSignedIn) return accountAnswered ? 'account' : 'wait';
  return isGuest ? 'guest' : 'none';
}

/** Loads CV data from Convex or localStorage, once. */
export function useCVLoader(
  user: unknown,
  userData: EditorAccountData | null | undefined,
  isGuest: boolean,
): CVLoaderResult {
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [designSettings, setDesignSettings] = useState<DesignSettings>(DEFAULT_DESIGN);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(DEFAULT_DESIGN.template);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedJobDescription, setLoadedJobDescription] = useState('');
  const [corrections, setCorrections] = useState<string[]>([]);

  /**
   * The CV as loaded, its design migrated in the CV too: the AI actions save
   * the CV with the design it carries, and wrote a removed template or the
   * "Mode ATS" flag back before the auto-save replaced it.
   */
  const applyLoaded = (source: CVData) => {
    // Form defects the code can fix without inventing anything are fixed here,
    // once, on the CV the editor opens on (arbitrage of 2026-11-06). The
    // auto-save then persists the corrected CV like any other change.
    const { cv: loaded, corrections: corrected } = autoCorrect(source, detectCVLanguage(source));
    if (corrected.length > 0) setCorrections(corrected);
    if (!loaded.design) {
      setCvData(loaded);
      return;
    }
    const design = migratedDesign(loaded.design);
    setCvData({ ...loaded, design });
    setDesignSettings(design);
    setSelectedTemplate(design.template);
  };

  // Load data — ONCE at initialization
  const dataLoaded = useRef(false);
  useEffect(() => {
    if (dataLoaded.current) return;
    const source = cvSourceOf(Boolean(user), userData !== undefined, isGuest);
    if (source === 'wait') return;
    dataLoaded.current = true;
    if (source === 'account' && userData) {
      if (userData.lastGeneratedCV) {
        // Strip Convex / table-level fields that leak in from previously-saved
        // cvs records — keeping them would break the next save mutation.
        const clean = stripPersistenceArtifacts(userData.lastGeneratedCV as CVData);
        applyLoaded(clean);
      }
      if (userData.lastJobDescription) {
        setLoadedJobDescription(userData.lastJobDescription);
      }
    } else if (source === 'guest') {
      const stored = readStoredJSON<CVData | null>('guest_last_optimized', null);
      if (stored) applyLoaded(stripPersistenceArtifacts(stored));
      const storedJD = readStoredText('guest_last_jd');
      if (storedJD) {
        setLoadedJobDescription(storedJD);
      }
    }
    // 'none' has nothing to read, and an account whose record does not exist
    // yet has nothing either: both stop loading rather than spin forever
    setIsLoading(false);
  }, [userData, user, isGuest]);

  return {
    cvData, setCvData,
    designSettings, setDesignSettings,
    selectedTemplate, setSelectedTemplate,
    isLoading,
    loadedJobDescription,
    corrections,
  };
}
