import { useMemo, useEffect, useRef, useState } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import type { ContentBlock, PageAssignment, SubBlock, SubBlockType } from '../lib/pagination/types';
import { getTemplateLayout } from '../lib/pagination/templateLayouts';
import { allocatePages } from '../lib/pagination/allocatePages';
import { buildBlocks } from '../lib/pagination/buildBlocks';

/**
 * Pagination pipeline with post-render DOM measurement.
 *
 * 1. Heuristic allocation (instant, for first paint)
 * 2. After paint, reads real heights from rendered .cv-page elements
 * 3. Re-allocates once with real heights (no loops — useRef + flag)
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
  const measuredRef = useRef<ContentBlock[] | null>(null);
  const prevBlockIds = useRef('');
  const [measureDone, setMeasureDone] = useState(false);

  const heuristicBlocks = useMemo(() => {
    if (!cvData) return [];
    return buildBlocks(cvData);
  }, [cvData]);

  const blockIds = heuristicBlocks.map(b => b.id).join('|');

  // After first paint, read real heights from the rendered CV pages + measurement container
  useEffect(() => {
    if (blockIds === prevBlockIds.current || heuristicBlocks.length === 0) return;
    prevBlockIds.current = blockIds;
    measuredRef.current = null;
    setMeasureDone(false);

    requestAnimationFrame(() => {
      // Read from measurement container (off-screen but correct widths)
      const mc = document.querySelector('[data-measure-container]');

      // Also read from live rendered pages (for blocks already in the DOM)
      const livePages = document.querySelectorAll('.cv-page');

      const measured = heuristicBlocks.map(block => {
        // Try measurement container first (has blocks at correct column widths)
        const mcMain = mc?.querySelector(`[data-measure-block="${block.id}"][data-measure-width="main"]`) as HTMLElement | null;
        const mcFull = mc?.querySelector(`[data-measure-block="${block.id}"][data-measure-width="full"]`) as HTMLElement | null;
        const mcSidebar = mc?.querySelector(`[data-measure-block="${block.id}"][data-measure-width="sidebar"]`) as HTMLElement | null;

        // Also try to find the block in the live rendered pages (most accurate)
        let liveEl: HTMLElement | null = null;
        livePages.forEach(page => {
          const el = page.querySelector(`[data-measure-id="${block.id}"]`) as HTMLElement | null;
          if (el && !liveEl) liveEl = el;
        });

        // Heights: prefer live > measurement container > heuristic
        const mainH = liveEl?.offsetHeight ?? mcMain?.offsetHeight ?? block.heightPx;
        const fullH = mcFull?.offsetHeight ?? block.fullWidthHeightPx;
        const sidebarH = mcSidebar?.offsetHeight ?? mainH;

        // For sidebar-type blocks, use sidebar measurement (narrower = taller)
        const SIDEBAR_TYPES = ['skill-category', 'education', 'languages'];
        const effectiveH = SIDEBAR_TYPES.includes(block.type)
          ? Math.max(mainH, sidebarH, liveEl?.offsetHeight ?? 0)
          : mainH;

        // Read sub-block heights from live or measurement container
        let subBlocks: SubBlock[] | undefined = block.subBlocks;
        const subSource = liveEl ?? mcMain;
        if (block.splittable && subSource) {
          const subEls = subSource.querySelectorAll('[data-sub-id]');
          if (subEls.length > 0) {
            subBlocks = Array.from(subEls).map(subEl => ({
              id: subEl.getAttribute('data-sub-id') || '',
              heightPx: (subEl as HTMLElement).offsetHeight,
              type: (subEl.getAttribute('data-sub-type') || 'bullet') as SubBlockType,
            }));
          }
        }

        return { ...block, heightPx: effectiveH, fullWidthHeightPx: fullH, subBlocks };
      });

      measuredRef.current = measured;
      setMeasureDone(true);
    });
  }, [blockIds, heuristicBlocks]);

  const activeBlocks = measuredRef.current ?? heuristicBlocks;

  const pageAssignments = useMemo(() => {
    if (activeBlocks.length === 0) return [];
    return allocatePages(activeBlocks, layout, 99);
  }, [activeBlocks, layout, measureDone]);

  return { pageAssignments, actualPageCount: pageAssignments.length };
}
