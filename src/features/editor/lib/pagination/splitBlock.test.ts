import { describe, it, expect } from 'vitest';
import { splitBlock, getPlacedBlockHeight } from './splitBlock';
import type { ContentBlock, SubBlock } from './types';
import { MEASUREMENT_SAFETY_PX } from './types';

// ─── Helpers ───

function makeExpBlock(bulletCount: number, bulletHeight = 24): ContentBlock {
  const subs: SubBlock[] = [
    { id: 'header', heightPx: 80, type: 'exp-header' },
    ...Array.from({ length: bulletCount }, (_, i) => ({
      id: `bullet-${i}`,
      heightPx: bulletHeight,
      type: 'bullet' as const,
    })),
  ];
  return {
    id: 'exp-0',
    type: 'experience',
    heightPx: subs.reduce((s, b) => s + b.heightPx, 0),
    splittable: true,
    subBlocks: subs,
    data: {} as never,
  };
}

// ─── Experience Split Tests ───

describe('splitBlock — experience', () => {
  it('splits experience keeping header + 2 bullets when enough space', () => {
    const block = makeExpBlock(4, 24);
    // headerH = 80 + safety. Each bullet check: usedPx + bullet + safety <= remaining
    // Need: header(80+S) + bullet1(24) + bullet2_check(24+S) to fit but bullet3 not
    const space = 80 + MEASUREMENT_SAFETY_PX + 24 + 24 + MEASUREMENT_SAFETY_PX + 1;
    const result = splitBlock(block, space);
    expect(result).not.toBeNull();
    expect(result!.kept.startSubBlock).toBe(0);
    expect(result!.kept.endSubBlock).toBe(3); // header + 2 bullets
    expect(result!.overflow.startSubBlock).toBe(3);
    expect(result!.overflow.endSubBlock).toBe(5); // 2 remaining bullets
  });

  it('returns null when less than 2 bullets fit', () => {
    const block = makeExpBlock(4, 24);
    // Only space for header + 1 bullet (not enough for 2)
    const result = splitBlock(block, 80 + 24 + MEASUREMENT_SAFETY_PX - 1);
    expect(result).toBeNull();
  });

  it('returns null when header alone does not fit', () => {
    const block = makeExpBlock(4, 24);
    const result = splitBlock(block, 50);
    expect(result).toBeNull();
  });

  it('returns null for non-splittable blocks', () => {
    const block: ContentBlock = {
      id: 'header',
      type: 'header',
      heightPx: 200,
      splittable: false,
      data: {} as never,
    };
    expect(splitBlock(block, 100)).toBeNull();
  });

  it('returns null for skill-category blocks (not splittable anymore)', () => {
    const block: ContentBlock = {
      id: 'skill-0',
      type: 'skill-category',
      heightPx: 200,
      splittable: false,
      data: {} as never,
    };
    expect(splitBlock(block, 100)).toBeNull();
  });

  it('returns null when experience has fewer than 2 bullets', () => {
    const block = makeExpBlock(1, 24);
    const result = splitBlock(block, 200);
    expect(result).toBeNull();
  });

  it('returns null when everything fits (nothing to overflow)', () => {
    const block = makeExpBlock(3, 24);
    const result = splitBlock(block, 80 + MEASUREMENT_SAFETY_PX + 3 * (24 + MEASUREMENT_SAFETY_PX) + 10);
    expect(result).toBeNull();
  });
});

// ─── Continuation Slice Split (startFrom > 0) ───

describe('splitBlock — continuation slice', () => {
  it('splits a continuation slice with absolute indices and no header requirement', () => {
    const block = makeExpBlock(6, 24);
    // Continuation starts at sub-block 3 (bullets 2..5 remain).
    // Space for 2 bullets only.
    const space = MEASUREMENT_SAFETY_PX + 24 + 24 + MEASUREMENT_SAFETY_PX + 1;
    const result = splitBlock(block, space, 3);
    expect(result).not.toBeNull();
    expect(result!.kept.startSubBlock).toBe(3);
    expect(result!.kept.endSubBlock).toBe(5); // 2 bullets kept
    expect(result!.overflow.startSubBlock).toBe(5);
    expect(result!.overflow.endSubBlock).toBe(7); // 2 remaining bullets
  });

  it('returns null when the continuation has fewer than 2 remaining bullets', () => {
    const block = makeExpBlock(3, 24);
    // Continuation starts at the last bullet
    const result = splitBlock(block, 500, 3);
    expect(result).toBeNull();
  });
});

// ─── Placed Block Height ───

describe('getPlacedBlockHeight', () => {
  it('returns full height for unsplit block', () => {
    const block = makeExpBlock(3, 24);
    expect(getPlacedBlockHeight({ block })).toBe(block.heightPx);
  });

  it('returns slice height for split block', () => {
    const block = makeExpBlock(4, 24);
    // header(80) + 2 bullets(48) + safety
    const height = getPlacedBlockHeight({ block, startSubBlock: 0, endSubBlock: 3 });
    expect(height).toBe(80 + 24 + 24 + MEASUREMENT_SAFETY_PX);
  });
});
