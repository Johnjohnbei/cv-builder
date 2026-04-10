import { useEffect, useState } from 'react';
import type { ContentBlock, SubBlock, SubBlockType } from '../lib/pagination/types';

/**
 * Measures real DOM heights for content blocks rendered in a MeasurementContainer.
 *
 * Finds the container via `[data-measure-container]` attribute and reads
 * offsetHeight from elements with data-measure-block/data-measure-width.
 * Measures at three widths: main, full, and sidebar.
 */
export function useMeasureBlocks(
  blocks: ContentBlock[],
): { measuredBlocks: ContentBlock[]; measuring: boolean } {
  const [measuredBlocks, setMeasuredBlocks] = useState<ContentBlock[]>(blocks);
  const [measuring, setMeasuring] = useState(true);

  const blockIds = blocks.map(b => b.id).join('|');

  useEffect(() => {
    if (blocks.length === 0) {
      setMeasuredBlocks([]);
      setMeasuring(false);
      return;
    }

    setMeasuring(true);

    // Delay to ensure MeasurementContainer has rendered and painted
    const timer = setTimeout(() => {
      const container = document.querySelector('[data-measure-container]');
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

      setMeasuredBlocks(measured);
      setMeasuring(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [blockIds, blocks]);

  return { measuredBlocks, measuring };
}
