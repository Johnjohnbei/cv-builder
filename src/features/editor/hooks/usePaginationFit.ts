import { useMemo } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import type { ContentBlock, PageAssignment } from '../lib/pagination/types';
import { getTemplateLayout } from '../lib/pagination/templateLayouts';
import { allocatePages } from '../lib/pagination/allocatePages';
import { buildBlocks } from '../lib/pagination/buildBlocks';
import { useMeasureBlocks } from './useMeasureBlocks';

/**
 * Orchestrates the full pagination pipeline:
 * 1. Build content blocks from CVData (with heuristic heights as initial pass)
 * 2. Measure real DOM heights via useMeasureBlocks
 * 3. Allocate blocks to pages — number of pages is determined by content
 *
 * No auto-condense: pages grow organically based on visible content.
 */
export function usePaginationFit(
  cvData: CVData | null,
  designSettings: DesignSettings,
  selectedTemplate: string,
): {
  pageAssignments: PageAssignment[];
  actualPageCount: number;
  heuristicBlocks: ContentBlock[];
} {
  const layout = useMemo(() => getTemplateLayout(selectedTemplate), [selectedTemplate]);

  // Step 1: Build blocks with heuristic heights (fast, synchronous)
  const heuristicBlocks = useMemo(() => {
    if (!cvData) return [];
    return buildBlocks(cvData);
  }, [cvData]);

  // Step 2: Measure real DOM heights from MeasurementContainer
  const { measuredBlocks, measuring } = useMeasureBlocks(heuristicBlocks);

  // Step 3: Allocate pages using measured heights (or heuristics while measuring)
  const activeBlocks = measuring ? heuristicBlocks : measuredBlocks;

  const pageAssignments = useMemo(() => {
    if (activeBlocks.length === 0) return [];
    const result = allocatePages(activeBlocks, layout, 99);
    console.log('[usePaginationFit] allocated', result.length, 'pages, measuring:', measuring, 'blocks sample:', activeBlocks[0]?.heightPx);
    return result;
  }, [activeBlocks, layout, measuring]);

  const actualPageCount = pageAssignments.length;

  return { pageAssignments, actualPageCount, heuristicBlocks };
}
