import { useState, useEffect, useRef, type RefObject } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import { extractKeywords, scoreExperience } from '../lib/scoring';
import { condenseOneStep } from '../lib/autoFit';

const MAX_FIT_ITERATIONS = 50;

/**
 * Detects overflow on the CV container and runs auto-fit condensation.
 * Returns overflowPx and a reset function for fitIterations.
 */
export function useOverflowDetection(
  cvRef: RefObject<HTMLDivElement | null>,
  cvData: CVData | null,
  designSettings: DesignSettings,
  jobDescription: string,
  userModified: boolean,
  isExporting: boolean,
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>,
) {
  const [overflowPx, setOverflowPx] = useState(0);
  const fitIterations = useRef(0);

  useEffect(() => {
    const el = cvRef.current;
    if (!el) { setOverflowPx(0); return; }

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const overflow = el.scrollHeight - el.clientHeight;
        setOverflowPx(Math.max(0, overflow));

        // Auto-fit: condense one step if overflowing and not user-modified
        if (overflow > 2 && !userModified && !isExporting && cvData && fitIterations.current < MAX_FIT_ITERATIONS) {
          const keywords = extractKeywords(jobDescription);
          const priorities = cvData.experience.map(exp => scoreExperience(exp, keywords));
          const result = condenseOneStep(cvData.experience, cvData.skills, priorities);
          if (result) {
            fitIterations.current++;
            setCvData(prev => prev ? { ...prev, experience: result.experiences, skills: result.skills } : null);
          }
        }
      });
    });

    return () => cancelAnimationFrame(raf);
  }, [cvData, designSettings, userModified, isExporting, jobDescription]);

  const resetFitIterations = () => { fitIterations.current = 0; };

  return { overflowPx, resetFitIterations } as const;
}
