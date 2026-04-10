import { useEffect, useState, useRef } from 'react';
import type { ContentBlock, SubBlock, SubBlockType } from '../lib/pagination/types';

/**
 * Measures real DOM heights for content blocks rendered in a MeasurementContainer.
 * Measures ONCE after initial render, then stops to prevent re-allocation loops.
 */
export function useMeasureBlocks(
  blocks: ContentBlock[],
): { measuredBlocks: ContentBlock[]; measuring: boolean } {
  const [measuredBlocks, setMeasuredBlocks] = useState<ContentBlock[]>(blocks);
  const [measuring, setMeasuring] = useState(true);
  const hasMeasured = useRef(false);
  const prevBlockIds = useRef('');

  const blockIds = blocks.map(b => b.id).join('|');

  useEffect(() => {
    // Only re-measure if block IDs actually changed (new CV data, not re-allocation)
    if (blockIds === prevBlockIds.current && hasMeasured.current) return;
    prevBlockIds.current = blockIds;

    if (blocks.length === 0) {
      setMeasuredBlocks([]);
      setMeasuring(false);
      return;
    }

    setMeasuring(true);
    hasMeasured.current = false;

    const timer = setTimeout(() => {
      const container = document.querySelector('[data-measure-container]');
      if (!container) {
        setMeasuredBlocks(blocks);
        setMeasuring(false);
        hasMeasured.current = true;
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

      hasMeasured.current = true;
      setMeasuredBlocks(measured);
      setMeasuring(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [blockIds, blocks]);

  return { measuredBlocks, measuring };
}
