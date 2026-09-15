import { useState, useEffect, useRef } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import { DEFAULT_DESIGN } from '@/src/shared/types';
import { stripPersistenceArtifacts } from './useCVPersistence';
import { readStoredJSON, readStoredText } from '@/src/shared/lib/storage';

interface CVLoaderResult {
  cvData: CVData | null;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  designSettings: DesignSettings;
  setDesignSettings: React.Dispatch<React.SetStateAction<DesignSettings>>;
  selectedTemplate: string;
  setSelectedTemplate: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
  loadedJobDescription: string;
}

/** Loads CV data from Convex or localStorage, once. */
export function useCVLoader(
  user: any,
  userData: any,
  isGuest: boolean,
): CVLoaderResult {
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [designSettings, setDesignSettings] = useState<DesignSettings>(DEFAULT_DESIGN);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(DEFAULT_DESIGN.template);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedJobDescription, setLoadedJobDescription] = useState('');

  // Load data — ONCE at initialization
  const dataLoaded = useRef(false);
  useEffect(() => {
    if (dataLoaded.current) return;
    if (user && userData) {
      dataLoaded.current = true;
      if (userData.lastGeneratedCV) {
        // Strip Convex / table-level fields that leak in from previously-saved
        // cvs records — keeping them would break the next save mutation.
        const clean = stripPersistenceArtifacts(userData.lastGeneratedCV) as CVData;
        setCvData(clean);
        if (clean.design) {
          setDesignSettings(clean.design);
          setSelectedTemplate(clean.design.template);
        }
      }
      if (userData.lastJobDescription) {
        setLoadedJobDescription(userData.lastJobDescription);
      }
      setIsLoading(false);
    } else if (isGuest) {
      dataLoaded.current = true;
      const stored = readStoredJSON<CVData | null>('guest_last_optimized', null);
      if (stored) {
        const data = stripPersistenceArtifacts(stored);
        setCvData(data);
        if (data.design) {
          setDesignSettings(data.design);
          setSelectedTemplate(data.design.template);
        }
      }
      const storedJD = readStoredText('guest_last_jd');
      if (storedJD) {
        setLoadedJobDescription(storedJD);
      }
      setIsLoading(false);
    } else if (userData === null) {
      setIsLoading(false);
    }
  }, [userData, user, isGuest]);

  return {
    cvData, setCvData,
    designSettings, setDesignSettings,
    selectedTemplate, setSelectedTemplate,
    isLoading,
    loadedJobDescription,
  };
}
