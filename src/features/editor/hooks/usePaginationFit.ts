import { useMemo } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import type { ContentBlock, PageAssignment } from '../lib/pagination/types';
import { getTemplateLayout } from '../lib/pagination/templateLayouts';
import { allocatePages } from '../lib/pagination/allocatePages';
import { buildBlocks } from '../lib/pagination/buildBlocks';

/**
 * Orchestrates the pagination pipeline:
 * 1. Build content blocks from CVData with heuristic heights
 * 2. Allocate blocks to pages — number of pages determined by content
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

  const heuristicBlocks = useMemo(() => {
    if (!cvData) return [];
    return buildBlocks(cvData);
  }, [cvData]);

  const pageAssignments = useMemo(() => {
    if (heuristicBlocks.length === 0) return [];
    return allocatePages(heuristicBlocks, layout, 99);
  }, [heuristicBlocks, layout]);

  const actualPageCount = pageAssignments.length;

  return { pageAssignments, actualPageCount, heuristicBlocks };
}
