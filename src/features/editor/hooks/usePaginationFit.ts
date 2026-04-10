import { useMemo, useEffect, useRef, useState } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import type { ContentBlock, PageAssignment, SubBlock, SubBlockType } from '../lib/pagination/types';
import { getTemplateLayout } from '../lib/pagination/templateLayouts';
import { allocatePages } from '../lib/pagination/allocatePages';
import { buildBlocks } from '../lib/pagination/buildBlocks';

/**
 * Builds content blocks, measures real DOM heights once, then allocates pages.
 *
 * Cycle: heuristic blocks → render → measure DOM → re-allocate once → done.
 * Uses useRef for measurements to avoid re-render loops.
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

  // Step 1: heuristic blocks (synchronous, for initial render)
  const heuristicBlocks = useMemo(() => {
    if (!cvData) return [];
    return buildBlocks(cvData);
  }, [cvData]);

  const blockIds = heuristicBlocks.map(b => b.id).join('|');

  // Step 2: measure DOM once after paint, only when content changes
  useEffect(() => {
    if (blockIds === prevBlockIds.current || heuristicBlocks.length === 0) return;
    prevBlockIds.current = blockIds;
    measuredRef.current = null;
    setMeasureDone(false);

    requestAnimationFrame(() => {
      const container = document.querySelector('[data-measure-container]');
      if (!container) {
        setMeasureDone(true);
        return;
      }

      const measured = heuristicBlocks.map(block => {
        const mainEl = container.querySelector(`[data-measure-block="${block.id}"][data-measure-width="main"]`) as HTMLElement | null;
        const fullEl = container.querySelector(`[data-measure-block="${block.id}"][data-measure-width="full"]`) as HTMLElement | null;

        let subBlocks: SubBlock[] | undefined = block.subBlocks;
        if (block.splittable && mainEl) {
          const subEls = mainEl.querySelectorAll('[data-sub-id]');
          if (subEls.length > 0) {
            subBlocks = Array.from(subEls).map(subEl => ({
              id: subEl.getAttribute('data-sub-id') || '',
              heightPx: (subEl as HTMLElement).offsetHeight,
              type: (subEl.getAttribute('data-sub-type') || 'bullet') as SubBlockType,
            }));
          }
        }

        return {
          ...block,
          heightPx: mainEl ? mainEl.offsetHeight : block.heightPx,
          fullWidthHeightPx: fullEl ? fullEl.offsetHeight : block.fullWidthHeightPx,
          subBlocks,
        };
      });

      measuredRef.current = measured;
      setMeasureDone(true); // single re-render trigger
    });
  }, [blockIds, heuristicBlocks]);

  // Step 3: allocate with best available heights
  const activeBlocks = measuredRef.current ?? heuristicBlocks;

  const pageAssignments = useMemo(() => {
    if (activeBlocks.length === 0) return [];
    return allocatePages(activeBlocks, layout, 99);
    // measureDone is in deps to re-allocate after measurement
  }, [activeBlocks, layout, measureDone]);

  return { pageAssignments, actualPageCount: pageAssignments.length };
}
