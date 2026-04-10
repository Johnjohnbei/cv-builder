import { useRef, useLayoutEffect, useState, useCallback } from 'react';
import type { ContentBlock, SubBlock, SubBlockType } from '../lib/pagination/types';
import { MEASUREMENT_SAFETY_PX } from '../lib/pagination/types';

/**
 * A block descriptor passed to the measurement hook.
 * The hook renders these as React elements, measures their height,
 * and returns ContentBlock objects with measured dimensions.
 */
export interface MeasurableBlock {
  id: string;
  type: ContentBlock['type'];
  splittable: boolean;
  data: ContentBlock['data'];
  /** Sub-block types for splittable blocks (used to find sub-block elements) */
  subBlockTypes?: SubBlockType[];
}

interface MeasureResult {
  blocks: ContentBlock[];
  measuring: boolean;
}

/**
 * Measures the pixel height of DOM elements rendered inside a measurement container.
 *
 * Usage:
 * 1. Render blocks inside a MeasurementContainer, each wrapped with `data-measure-id={id}`
 * 2. For splittable blocks, mark sub-elements with `data-sub-id={subId}` and `data-sub-type={type}`
 * 3. Call `measure()` after render to read heights
 *
 * The hook reads heights from the DOM via refs, producing ContentBlock objects
 * that the pagination allocator can consume.
 */
export function useMeasureBlocks(
  containerRef: React.RefObject<HTMLDivElement | null>,
  descriptors: MeasurableBlock[],
): MeasureResult {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [measuring, setMeasuring] = useState(true);
  const prevDescriptorsKey = useRef('');

  // Create a stable key from descriptors to detect changes
  const descriptorsKey = descriptors.map(d => `${d.id}:${d.type}`).join('|');

  useLayoutEffect(() => {
    if (descriptorsKey === prevDescriptorsKey.current) return;
    prevDescriptorsKey.current = descriptorsKey;

    const container = containerRef.current;
    if (!container || descriptors.length === 0) {
      setBlocks([]);
      setMeasuring(false);
      return;
    }

    // Wait for next frame to ensure DOM is painted
    const raf = requestAnimationFrame(() => {
      const measured: ContentBlock[] = [];

      for (const desc of descriptors) {
        const el = container.querySelector(`[data-measure-id="${desc.id}"]`) as HTMLElement | null;
        if (!el) continue;

        const heightPx = el.offsetHeight + MEASUREMENT_SAFETY_PX;

        // Measure sub-blocks for splittable blocks
        let subBlocks: SubBlock[] | undefined;
        if (desc.splittable) {
          const subEls = el.querySelectorAll('[data-sub-id]');
          if (subEls.length > 0) {
            subBlocks = Array.from(subEls).map(subEl => ({
              id: subEl.getAttribute('data-sub-id') || '',
              heightPx: (subEl as HTMLElement).offsetHeight,
              type: (subEl.getAttribute('data-sub-type') || 'bullet') as SubBlockType,
            }));
          }
        }

        measured.push({
          id: desc.id,
          type: desc.type,
          heightPx,
          fullWidthHeightPx: heightPx, // Will be overridden by second pass if needed
          splittable: desc.splittable,
          subBlocks,
          data: desc.data,
        });
      }

      setBlocks(measured);
      setMeasuring(false);
    });

    return () => cancelAnimationFrame(raf);
  }, [descriptorsKey, containerRef, descriptors]);

  return { blocks, measuring };
}

/**
 * Merge two measurement passes: main-column widths and full-widths.
 * The main pass provides `heightPx`, the full-width pass provides `fullWidthHeightPx`.
 */
export function mergeBlockMeasurements(
  mainBlocks: ContentBlock[],
  fullWidthBlocks: ContentBlock[],
): ContentBlock[] {
  const fullWidthMap = new Map(fullWidthBlocks.map(b => [b.id, b.heightPx]));

  return mainBlocks.map(block => ({
    ...block,
    fullWidthHeightPx: fullWidthMap.get(block.id) ?? block.heightPx,
  }));
}
