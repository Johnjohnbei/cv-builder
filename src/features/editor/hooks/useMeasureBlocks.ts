import { useLayoutEffect, useState, useRef } from 'react';
import type { ContentBlock, SubBlock, SubBlockType, BlockRendererMap, PlacedBlock } from '../lib/pagination/types';
import type { DesignSettings } from '@/src/shared/types';
import type { SupportedLanguage } from '@/src/lib/languageDetection';

/**
 * Measures real DOM heights for content blocks rendered in a hidden container.
 *
 * Renders each block at two widths (main column + full width) using actual
 * block renderers, then reads offsetHeight from the DOM.
 *
 * Returns measured ContentBlock[] with real pixel heights, replacing heuristic estimates.
 */
export function useMeasureBlocks(
  containerRef: React.RefObject<HTMLDivElement | null>,
  blocks: ContentBlock[],
  blockRenderers: BlockRendererMap,
  designSettings: DesignSettings,
  language: SupportedLanguage,
  mainWidthMm: number,
  fullWidthMm: number,
): { measuredBlocks: ContentBlock[]; measuring: boolean } {
  const [measuredBlocks, setMeasuredBlocks] = useState<ContentBlock[]>(blocks);
  const [measuring, setMeasuring] = useState(true);
  const prevKey = useRef('');

  // Stable key to detect when blocks change
  const key = blocks.map(b => b.id).join('|') + `|${mainWidthMm}|${fullWidthMm}`;

  useLayoutEffect(() => {
    if (key === prevKey.current || blocks.length === 0) {
      if (blocks.length === 0) {
        setMeasuredBlocks([]);
        setMeasuring(false);
      }
      return;
    }
    prevKey.current = key;

    const container = containerRef.current;
    if (!container) {
      setMeasuredBlocks(blocks);
      setMeasuring(false);
      return;
    }

    // Wait for paint
    const raf = requestAnimationFrame(() => {
      const measured: ContentBlock[] = [];

      for (const block of blocks) {
        // Read main-column height
        const mainEl = container.querySelector(`[data-measure-block="${block.id}"][data-measure-width="main"]`) as HTMLElement | null;
        const mainH = mainEl ? mainEl.offsetHeight : block.heightPx;

        // Read full-width height
        const fullEl = container.querySelector(`[data-measure-block="${block.id}"][data-measure-width="full"]`) as HTMLElement | null;
        const fullH = fullEl ? fullEl.offsetHeight : block.fullWidthHeightPx;

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
          subBlocks,
        });
      }

      setMeasuredBlocks(measured);
      setMeasuring(false);
    });

    return () => cancelAnimationFrame(raf);
  }, [key, containerRef, blocks]);

  return { measuredBlocks, measuring };
}
