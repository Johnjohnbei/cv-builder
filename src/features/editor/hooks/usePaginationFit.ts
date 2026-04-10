import { useEffect, useRef, useMemo } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import type { PageAssignment } from '../lib/pagination/types';
import { getTemplateLayout } from '../lib/pagination/templateLayouts';
import { allocatePages } from '../lib/pagination/allocatePages';
import { buildBlocks } from '../lib/pagination/buildBlocks';
import { extractKeywords, scoreExperience } from '../lib/scoring';
import { condenseOneStep } from '../lib/autoFit';

const MAX_FIT_ITERATIONS = 50;

/**
 * Orchestrates the full pagination pipeline:
 * 1. Build content blocks from CVData (with estimated heights)
 * 2. Allocate blocks to pages via the pagination engine
 * 3. Auto-condense if actual pages exceed pageLimit
 *
 * Replaces useOverflowDetection with a proper pagination-aware system.
 */
export function usePaginationFit(
  cvData: CVData | null,
  designSettings: DesignSettings,
  selectedTemplate: string,
  jobDescription: string,
  userModified: boolean,
  isExporting: boolean,
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>,
): {
  pageAssignments: PageAssignment[];
  actualPageCount: number;
} {
  const fitIterations = useRef(0);
  const layout = useMemo(() => getTemplateLayout(selectedTemplate), [selectedTemplate]);
  const pageLimit = designSettings.pageLimit || 2;

  const pageAssignments = useMemo(() => {
    if (!cvData) return [];
    const blocks = buildBlocks(cvData);
    return allocatePages(blocks, layout, pageLimit);
  }, [cvData, layout, pageLimit]);

  const actualPageCount = pageAssignments.length;

  // Auto-fit: condense if we exceed pageLimit
  useEffect(() => {
    if (!cvData || userModified || isExporting) return;
    if (actualPageCount <= pageLimit) return;
    if (fitIterations.current >= MAX_FIT_ITERATIONS) return;

    const keywords = extractKeywords(jobDescription);
    const priorities = cvData.experience.map(exp => scoreExperience(exp, keywords));
    const result = condenseOneStep(cvData.experience, cvData.skills, priorities);

    if (result) {
      fitIterations.current++;
      setCvData(prev => prev ? { ...prev, experience: result.experiences, skills: result.skills } : null);
    }
  }, [cvData, actualPageCount, pageLimit, userModified, isExporting, jobDescription, setCvData]);

  return { pageAssignments, actualPageCount };
}
