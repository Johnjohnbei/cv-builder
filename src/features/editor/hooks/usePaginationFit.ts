import { useEffect, useRef, useMemo } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import type { ContentBlock, PageAssignment } from '../lib/pagination/types';
import { getTemplateLayout } from '../lib/pagination/templateLayouts';
import { allocatePages } from '../lib/pagination/allocatePages';
import { buildBlocks } from '../lib/pagination/buildBlocks';
import { useMeasureBlocks } from './useMeasureBlocks';
import { extractKeywords, scoreExperience } from '../lib/scoring';
import { condenseOneStep } from '../lib/autoFit';

const MAX_FIT_ITERATIONS = 50;

/**
 * Orchestrates the full pagination pipeline:
 * 1. Build content blocks from CVData (with heuristic heights as initial pass)
 * 2. Measure real DOM heights via useMeasureBlocks
 * 3. Allocate blocks to pages using measured heights
 * 4. Auto-condense if actual pages exceed pageLimit
 */
export function usePaginationFit(
  cvData: CVData | null,
  designSettings: DesignSettings,
  selectedTemplate: string,
  jobDescription: string,
  userModified: boolean,
  isExporting: boolean,
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>,
  measureRef: React.RefObject<HTMLDivElement | null>,
): {
  pageAssignments: PageAssignment[];
  actualPageCount: number;
  heuristicBlocks: ContentBlock[];
} {
  const fitIterations = useRef(0);
  const layout = useMemo(() => getTemplateLayout(selectedTemplate), [selectedTemplate]);
  const pageLimit = designSettings.pageLimit || 2;

  // Step 1: Build blocks with heuristic heights (fast, synchronous)
  const heuristicBlocks = useMemo(() => {
    if (!cvData) return [];
    return buildBlocks(cvData);
  }, [cvData]);

  // Step 2: Measure real DOM heights from MeasurementContainer
  const { measuredBlocks, measuring } = useMeasureBlocks(measureRef, heuristicBlocks);

  // Step 3: Allocate pages using measured heights (or heuristics while measuring)
  const activeBlocks = measuring ? heuristicBlocks : measuredBlocks;

  const pageAssignments = useMemo(() => {
    if (activeBlocks.length === 0) return [];
    return allocatePages(activeBlocks, layout, pageLimit);
  }, [activeBlocks, layout, pageLimit]);

  const actualPageCount = pageAssignments.length;

  // Step 4: Auto-fit condense if we exceed pageLimit
  useEffect(() => {
    if (!cvData || userModified || isExporting) return;
    if (actualPageCount <= pageLimit) return;
    if (fitIterations.current >= MAX_FIT_ITERATIONS) return;

    const keywords = extractKeywords(jobDescription);
    const priorities = cvData.experience.map(exp => scoreExperience(exp, keywords));
    const result = condenseOneStep(cvData.experience, cvData.skills, priorities);

    if (result) {
      fitIterations.current++;
      setCvData(prev => prev ? { ...prev, experience: result.experiences, skills: result.skills } : prev);
    }
  }, [cvData, actualPageCount, pageLimit, userModified, isExporting, jobDescription, setCvData]);

  return { pageAssignments, actualPageCount, heuristicBlocks };
}
