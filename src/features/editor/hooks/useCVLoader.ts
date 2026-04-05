import { useState, useEffect, useRef } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import { DEFAULT_DESIGN } from '@/src/shared/types';
import { autoAssignModes, extractKeywords } from '../lib/scoring';

interface CVLoaderResult {
  cvData: CVData | null;
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>;
  designSettings: DesignSettings;
  setDesignSettings: React.Dispatch<React.SetStateAction<DesignSettings>>;
  selectedTemplate: string;
  setSelectedTemplate: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
  userModified: boolean;
  setUserModified: React.Dispatch<React.SetStateAction<boolean>>;
  resetAutoAssign: () => void;
}

/**
 * Loads CV data from Convex or localStorage once, and handles auto-assignment
 * of display modes when CV data lacks them.
 */
export function useCVLoader(
  user: any,
  userData: any,
  isGuest: boolean,
  jobDescription: string,
): CVLoaderResult {
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [designSettings, setDesignSettings] = useState<DesignSettings>(DEFAULT_DESIGN);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('TEMPLATE_A');
  const [isLoading, setIsLoading] = useState(true);
  const [userModified, setUserModified] = useState(false);

  // Load data — ONCE at initialization
  const dataLoaded = useRef(false);
  useEffect(() => {
    if (dataLoaded.current) return;
    if (user && userData) {
      dataLoaded.current = true;
      if (userData.lastGeneratedCV) {
        setCvData(userData.lastGeneratedCV);
        if (userData.lastGeneratedCV.design) {
          setDesignSettings(userData.lastGeneratedCV.design);
          setSelectedTemplate(userData.lastGeneratedCV.design.template);
        }
      }
      setIsLoading(false);
    } else if (isGuest) {
      dataLoaded.current = true;
      const stored = localStorage.getItem('guest_last_optimized');
      if (stored) {
        const data = JSON.parse(stored);
        setCvData(data);
        if (data.design) {
          setDesignSettings(data.design);
          setSelectedTemplate(data.design.template);
        }
      }
      setIsLoading(false);
    } else if (userData === null) {
      setIsLoading(false);
    }
  }, [userData, user, isGuest]);

  // Auto-assign display modes when CV is loaded without them
  const hasAutoAssigned = useRef(false);
  useEffect(() => {
    if (!cvData || !cvData.experience?.length || hasAutoAssigned.current) return;
    const hasAnyMode = cvData.experience.some(exp => exp.displayMode);
    if (hasAnyMode) { hasAutoAssigned.current = true; return; }

    hasAutoAssigned.current = true;
    const keywords = extractKeywords(jobDescription);
    const autoExperiences = autoAssignModes(cvData.experience, keywords, designSettings.pageLimit || 1);
    setCvData(prev => prev ? { ...prev, experience: autoExperiences } : null);
  }, [cvData?.experience?.length]);

  const resetAutoAssign = () => {
    hasAutoAssigned.current = false;
  };

  return {
    cvData, setCvData,
    designSettings, setDesignSettings,
    selectedTemplate, setSelectedTemplate,
    isLoading,
    userModified, setUserModified,
    resetAutoAssign,
  };
}
