// ─── Live DOM reconciliation ───
// Extracted from usePaginationFit, over its size limit: reading the rendered
// heights and folding them back into the blocks is pure, apart from the DOM read.

import type { ContentBlock, PageAssignment, SubBlock, SubBlockType } from './types';
import { MEASUREMENT_SAFETY_PX } from './types';

/** Ignore sub-pixel drift below this threshold when checking stability */
const HEIGHT_DIFF_THRESHOLD_PX = 1;

interface LiveMeasurements {
  /** Per-block measured heights (offsetHeight in its rendered context) */
  blockHeights: Map<string, number>;
  /** Per-block sub-block heights, accumulated across every rendered slice */
  blockSubBlocks: Map<string, SubBlock[]>;
  /** Measured section-title heights (experience + skills), if present */
  sectionTitles: { experience?: number; skills?: number };
}

/** Read all live heights from the unified CV DOM tree. Null if not yet rendered. */
export function readLiveDOM(): LiveMeasurements | null {
  const cvRoot = document.querySelector('[data-cv-root]');
  if (!cvRoot) return null;

  const blockHeights = new Map<string, number>();
  const blockSubBlocks = new Map<string, SubBlock[]>();

  const blockEls = cvRoot.querySelectorAll('[data-live-block]') as NodeListOf<HTMLElement>;
  blockEls.forEach(el => {
    const id = el.getAttribute('data-live-block');
    if (!id) return;
    blockHeights.set(id, el.offsetHeight);

    // Read sub-blocks from within this element. A block split across pages
    // renders as several [data-live-block] elements with the SAME id, each
    // holding a different sub-block slice — accumulate them all (sub ids are
    // unique, absolute indices) so the merged picture covers the whole block.
    const subEls = el.querySelectorAll('[data-sub-id]') as NodeListOf<HTMLElement>;
    if (subEls.length > 0) {
      const acc = blockSubBlocks.get(id) ?? [];
      subEls.forEach(subEl => {
        acc.push({
          id: subEl.getAttribute('data-sub-id') || '',
          heightPx: subEl.offsetHeight,
          type: (subEl.getAttribute('data-sub-type') || 'bullet') as SubBlockType,
        });
      });
      blockSubBlocks.set(id, acc);
    }
  });

  const sectionTitles: { experience?: number; skills?: number } = {};
  const expTitleEl = cvRoot.querySelector('[data-live-title="experience"]') as HTMLElement | null;
  if (expTitleEl) sectionTitles.experience = expTitleEl.offsetHeight;
  const skillsTitleEl = cvRoot.querySelector('[data-live-title="skills"]') as HTMLElement | null;
  if (skillsTitleEl) sectionTitles.skills = skillsTitleEl.offsetHeight;

  return { blockHeights, blockSubBlocks, sectionTitles };
}

/**
 * Apply live measurements to source blocks. Returns new array (immutable).
 * Every page renders at the same width, so one measured height per block.
 *
 * Split blocks (rendered as multiple partial slices) don't have a meaningful
 * whole offsetHeight. For those, we merge the accumulated sub-block heights
 * and recompute the total from their sum.
 */
export function reconcileBlocks(
  source: ContentBlock[],
  live: LiveMeasurements,
  pageAssignments: PageAssignment[],
): ContentBlock[] {
  // Which placed blocks are rendered as slices
  const placed = new Set<string>();
  const split = new Set<string>();
  pageAssignments.forEach(page => page.blocks.forEach(pb => {
    placed.add(pb.block.id);
    if (pb.startSubBlock !== undefined) split.add(pb.block.id);
  }));

  return source.map(block => {
    const liveH = live.blockHeights.get(block.id);
    if (liveH === undefined || !placed.has(block.id)) return block;

    const liveSubs = live.blockSubBlocks.get(block.id);

    if (split.has(block.id)) {
      // Partial renders — offsetHeight doesn't represent the full block.
      // Merge the accumulated live sub-block heights and recompute the total
      // from the sum, so the block height converges even though no single
      // render ever shows all sub-blocks at once.
      if (!liveSubs || liveSubs.length === 0 || !block.subBlocks) return block;
      const liveMap = new Map(liveSubs.map(s => [s.id, s.heightPx]));
      const mergedSubs = block.subBlocks.map(sb => ({
        ...sb,
        heightPx: liveMap.get(sb.id) ?? sb.heightPx,
      }));
      const subTotal = mergedSubs.reduce((acc, s) => acc + s.heightPx, 0) + MEASUREMENT_SAFETY_PX;
      return { ...block, subBlocks: mergedSubs, heightPx: subTotal };
    }

    // Whole render. Only carry live sub-blocks over for blocks that model
    // sub-blocks (experiences); other renderers may tag decorative elements.
    const nextSubs = block.subBlocks ? (liveSubs ?? block.subBlocks) : undefined;
    return { ...block, heightPx: liveH, subBlocks: nextSubs };
  });
}

export function blocksStable(a: ContentBlock[], b: ContentBlock[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((block, i) => Math.abs(block.heightPx - b[i].heightPx) <= HEIGHT_DIFF_THRESHOLD_PX);
}
