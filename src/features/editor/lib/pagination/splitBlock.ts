// ─── Block Splitting Logic ───
// Splits a content block across a page boundary, respecting minimum keep rules.

import type { ContentBlock, PlacedBlock } from './types';
import { MIN_KEEP_SUB_BLOCKS, MEASUREMENT_SAFETY_PX } from './types';

interface SplitResult {
  /** Block portion that stays on the current page */
  kept: PlacedBlock;
  /** Block portion that overflows to the next page */
  overflow: PlacedBlock;
}

/**
 * Attempt to split a block to fit within `remainingPx` on the current page.
 *
 * Rules:
 * - Experience blocks split between bullets. The "exp-header" (position + company + intro)
 *   is insecable. At least MIN_KEEP_SUB_BLOCKS bullet sub-blocks must remain on the current page.
 * - Skill category blocks split between skill-row items. The "skill-title" sub-block
 *   + at least MIN_KEEP_SUB_BLOCKS items must fit.
 * - Non-splittable blocks (header, summary, education, languages) return null.
 *
 * Returns null if the block cannot be meaningfully split (not enough space for minimum).
 */
export function splitBlock(block: ContentBlock, remainingPx: number): SplitResult | null {
  if (!block.splittable || !block.subBlocks || block.subBlocks.length === 0) {
    return null;
  }

  const subs = block.subBlocks;

  if (block.type === 'experience') {
    return splitExperience(block, subs, remainingPx);
  }

  if (block.type === 'skill-category') {
    return splitSkillCategory(block, subs, remainingPx);
  }

  return null;
}

// ─── Experience Split ───

function splitExperience(
  block: ContentBlock,
  subs: NonNullable<ContentBlock['subBlocks']>,
  remainingPx: number,
): SplitResult | null {
  // The exp-header (position + company + intro) is always first and insecable
  const headerSubs = subs.filter(s => s.type === 'exp-header');
  const bulletSubs = subs.filter(s => s.type === 'bullet' || s.type === 'kpi');

  if (bulletSubs.length < MIN_KEEP_SUB_BLOCKS) {
    // Not enough bullets to split — move entire block
    return null;
  }

  // Calculate header height (all exp-header sub-blocks)
  const headerHeight = headerSubs.reduce((sum, s) => sum + s.heightPx, 0) + MEASUREMENT_SAFETY_PX;

  if (headerHeight > remainingPx) {
    // Header alone doesn't fit — move entire block
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
    // Not enough bullets fit — move entire block
    return null;
  }

  // Find the actual sub-block indices for the split point
  const headerCount = headerSubs.length;
  const splitIndex = headerCount + bulletsKept;

  return {
    kept: {
      block,
      startSubBlock: 0,
      endSubBlock: splitIndex,
    },
    overflow: {
      block,
      startSubBlock: splitIndex,
      endSubBlock: subs.length,
    },
  };
}

// ─── Skill Category Split ───

function splitSkillCategory(
  block: ContentBlock,
  subs: NonNullable<ContentBlock['subBlocks']>,
  remainingPx: number,
): SplitResult | null {
  // The skill-title is always first and insecable
  const titleSubs = subs.filter(s => s.type === 'skill-title');
  const itemSubs = subs.filter(s => s.type === 'skill-row');

  if (itemSubs.length < MIN_KEEP_SUB_BLOCKS) {
    return null;
  }

  const titleHeight = titleSubs.reduce((sum, s) => sum + s.heightPx, 0) + MEASUREMENT_SAFETY_PX;

  if (titleHeight > remainingPx) {
    return null;
  }

  let usedPx = titleHeight;
  let itemsKept = 0;

  for (const item of itemSubs) {
    if (usedPx + item.heightPx + MEASUREMENT_SAFETY_PX > remainingPx) break;
    usedPx += item.heightPx;
    itemsKept++;
  }

  if (itemsKept < MIN_KEEP_SUB_BLOCKS) {
    return null;
  }

  const titleCount = titleSubs.length;
  const splitIndex = titleCount + itemsKept;

  return {
    kept: {
      block,
      startSubBlock: 0,
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
