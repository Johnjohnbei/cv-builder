import { useEffect, useState, useRef } from 'react';
import type { ContentBlock, SubBlock, SubBlockType } from '../lib/pagination/types';

/**
 * Measures real DOM heights for content blocks rendered in a MeasurementContainer.
 *
 * Reads offsetHeight from elements with data-measure-block/data-measure-width
 * attributes at three widths: main, full, and sidebar.
 *
 * Uses useEffect (not useLayoutEffect) to ensure the MeasurementContainer
 * has fully rendered before reading measurements.
 */
export function useMeasureBlocks(
  containerRef: React.RefObject<HTMLDivElement | null>,
  blocks: ContentBlock[],
): { measuredBlocks: ContentBlock[]; measuring: boolean } {
  const [measuredBlocks, setMeasuredBlocks] = useState<ContentBlock[]>(blocks);
  const [measuring, setMeasuring] = useState(true);
  const measureCount = useRef(0);

  // Re-measure whenever blocks change (by id list)
  const blockIds = blocks.map(b => b.id).join('|');

  useEffect(() => {
    if (blocks.length === 0) {
      setMeasuredBlocks([]);
      setMeasuring(false);
      return;
    }

    setMeasuring(true);

    // Wait for paint + MeasurementContainer render
    const raf = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) {
        setMeasuredBlocks(blocks);
        setMeasuring(false);
        return;
      }

      const measured: ContentBlock[] = [];

      for (const block of blocks) {
        const mainEl = container.querySelector(`[data-measure-block="${block.id}"][data-measure-width="main"]`) as HTMLElement | null;
        const mainH = mainEl ? mainEl.offsetHeight : block.heightPx;

        const fullEl = container.querySelector(`[data-measure-block="${block.id}"][data-measure-width="full"]`) as HTMLElement | null;
        const fullH = fullEl ? fullEl.offsetHeight : block.fullWidthHeightPx;

        const sidebarEl = container.querySelector(`[data-measure-block="${block.id}"][data-measure-width="sidebar"]`) as HTMLElement | null;
        const sidebarH = sidebarEl ? sidebarEl.offsetHeight : undefined;

        // Read sub-block heights for splittable blocks
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

        measured.push({
          ...block,
          heightPx: mainH,
          fullWidthHeightPx: fullH,
          sidebarHeightPx: sidebarH,
          subBlocks,
        });
      }

      measureCount.current++;
      setMeasuredBlocks(measured);
      setMeasuring(false);
    });

    return () => cancelAnimationFrame(raf);
  }, [blockIds, containerRef, blocks]);

  return { measuredBlocks, measuring };
}
