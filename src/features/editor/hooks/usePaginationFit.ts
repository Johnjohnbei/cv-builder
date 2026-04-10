import { useMemo } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import type { PageAssignment } from '../lib/pagination/types';
import { getTemplateLayout } from '../lib/pagination/templateLayouts';
import { allocatePages } from '../lib/pagination/allocatePages';
import { buildBlocks } from '../lib/pagination/buildBlocks';

/**
 * Builds content blocks and allocates them to pages.
 * Heights are heuristic estimates with a 30% safety margin.
 * Pages grow organically based on visible content — no page limit.
 */
export function usePaginationFit(
  cvData: CVData | null,
  designSettings: DesignSettings,
  selectedTemplate: string,
): {
  pageAssignments: PageAssignment[];
  actualPageCount: number;
} {
  const layout = useMemo(() => getTemplateLayout(selectedTemplate), [selectedTemplate]);

  const blocks = useMemo(() => {
    if (!cvData) return [];
    return buildBlocks(cvData);
  }, [cvData]);

  const pageAssignments = useMemo(() => {
    if (blocks.length === 0) return [];
    return allocatePages(blocks, layout, 99);
  }, [blocks, layout]);

  return { pageAssignments, actualPageCount: pageAssignments.length };
}
