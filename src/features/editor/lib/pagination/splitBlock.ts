// ─── Block Splitting Logic ───
// Splits a content block across a page boundary, respecting minimum keep rules.
// All sub-block indices are ABSOLUTE (into block.subBlocks) so a slice can be
// split again on a later page and renderers can map indices to content 1:1.

import type { ContentBlock, PlacedBlock } from './types';
import { MIN_KEEP_SUB_BLOCKS, MEASUREMENT_SAFETY_PX } from './types';

interface SplitResult {
  /** Block portion that stays on the current page */
  kept: PlacedBlock;
  /** Block portion that overflows to the next page */
  overflow: PlacedBlock;
}

/**
 * Attempt to split a block (or a slice of it starting at `startFrom`) to fit
 * within `remainingPx` on the current page.
 *
 * Rules:
 * - Experience blocks split between bullets. The "exp-header" (position + company + intro)
 *   is insecable and only present when startFrom === 0 (continuation slices have no header).
 * - At least MIN_KEEP_SUB_BLOCKS bullet sub-blocks must remain on the current page,
 *   and at least one sub-block must overflow (otherwise it's not a split).
 * - Non-splittable blocks (header, summary, skills, education, languages) return null.
 */
export function splitBlock(block: ContentBlock, remainingPx: number, startFrom = 0): SplitResult | null {
  if (!block.splittable || !block.subBlocks || block.subBlocks.length === 0) {
    return null;
  }
  if (block.type !== 'experience') {
    return null;
  }

  const subs = block.subBlocks;
  const rest = subs.slice(startFrom);
  const headerSubs = startFrom === 0 ? rest.filter(s => s.type === 'exp-header') : [];
  const bulletSubs = rest.filter(s => s.type === 'bullet' || s.type === 'kpi');

  if (bulletSubs.length < MIN_KEEP_SUB_BLOCKS) {
    // Not enough bullets to split — move entire slice
    return null;
  }

  const headerHeight = headerSubs.reduce((sum, s) => sum + s.heightPx, 0) + MEASUREMENT_SAFETY_PX;

  if (headerHeight > remainingPx) {
    // Header alone doesn't fit — move entire slice
    return null;
  }

  // Find how many bullets fit after the header
  let usedPx = headerHeight;
  let bulletsKept = 0;

  for (const bullet of bulletSubs) {
    if (usedPx + bullet.heightPx + MEASUREMENT_SAFETY_PX > remainingPx) break;
    usedPx += bullet.heightPx;
    bulletsKept++;
  }

  if (bulletsKept < MIN_KEEP_SUB_BLOCKS) {
    // Not enough bullets fit — move entire slice
    return null;
  }

  const splitIndex = startFrom + headerSubs.length + bulletsKept;

  if (splitIndex >= subs.length) {
    // Everything fits — nothing to overflow, not a split
    return null;
  }

  return {
    kept: {
      block,
      startSubBlock: startFrom,
      endSubBlock: splitIndex,
    },
    overflow: {
      block,
      startSubBlock: splitIndex,
      endSubBlock: subs.length,
    },
  };
}

/**
 * Calculate the height of a placed block (potentially a slice of the full block).
 */
export function getPlacedBlockHeight(placed: PlacedBlock): number {
  const { block, startSubBlock, endSubBlock } = placed;

  // Full block (no split)
  if (startSubBlock === undefined || endSubBlock === undefined || !block.subBlocks) {
    return block.heightPx;
  }

  // Partial block — sum up the sub-block heights in the slice
  const slice = block.subBlocks.slice(startSubBlock, endSubBlock);
  return slice.reduce((sum, s) => sum + s.heightPx, 0) + MEASUREMENT_SAFETY_PX;
}
