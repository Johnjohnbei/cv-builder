import { describe, it, expect } from 'vitest';
import { allocatePages, isPageOverfilled } from './allocatePages';
import type { ContentBlock, TemplateLayout } from './types';

// ─── Test Layout (simplified 2-column) ───

const twoColLayout: TemplateLayout = {
  type: 'two-column-right',
  page1: {
    contentWidthMm: 176,
    mainColumnWidthMm: 109,
    sidebarWidthMm: 54,
    gapMm: 12.7,
    paddingTopMm: 16.9,
    paddingBottomMm: 10.6,
    paddingLeftMm: 16.9,
    paddingRightMm: 16.9,
  },
  page2Plus: {
    contentWidthMm: 176,
    paddingTopMm: 16.9,
    paddingBottomMm: 10.6,
    paddingLeftMm: 16.9,
    paddingRightMm: 16.9,
  },
  headerFullWidth: true,
};

const singleColLayout: TemplateLayout = {
  type: 'single-column',
  page1: {
    contentWidthMm: 176,
    mainColumnWidthMm: 176,
    sidebarWidthMm: 0,
    gapMm: 0,
    paddingTopMm: 16.9,
    paddingBottomMm: 10.6,
    paddingLeftMm: 16.9,
    paddingRightMm: 16.9,
  },
  page2Plus: {
    contentWidthMm: 176,
    paddingTopMm: 16.9,
    paddingBottomMm: 10.6,
    paddingLeftMm: 16.9,
    paddingRightMm: 16.9,
  },
  headerFullWidth: true,
};

// ─── Helpers ───

function block(id: string, type: ContentBlock['type'], heightPx: number, splittable = false): ContentBlock {
  return {
    id,
    type,
    heightPx,
    fullWidthHeightPx: heightPx,
    splittable,
    data: {} as never,
  };
}

function expBlock(id: string, totalHeight: number, bulletCount = 3): ContentBlock {
  const bulletHeight = Math.floor((totalHeight - 80) / bulletCount);
  return {
    id,
    type: 'experience',
    heightPx: totalHeight,
    fullWidthHeightPx: totalHeight,
    splittable: true,
    subBlocks: [
      { id: `${id}-header`, heightPx: 80, type: 'exp-header' },
      ...Array.from({ length: bulletCount }, (_, i) => ({
        id: `${id}-bullet-${i}`,
        heightPx: bulletHeight,
        type: 'bullet' as const,
      })),
    ],
    data: {} as never,
  };
}

// ─── Tests ───

describe('allocatePages', () => {
  it('places everything on page 1 when content fits', () => {
    const blocks = [
      block('header', 'header', 200),
      block('summary', 'summary', 100),
      expBlock('exp-0', 300),
      block('skills', 'skill-category', 200),
    ];

    const pages = allocatePages(blocks, twoColLayout);

    expect(pages).toHaveLength(1);
    expect(pages[0].layoutMode).toBe('two-column');
    expect(pages[0].blocks.length).toBeGreaterThanOrEqual(3); // header + summary + exp
    expect(pages[0].sidebarBlocks?.length).toBe(1); // skills
  });

  it('overflows to page 2 full-width when page 1 is full', () => {
    const blocks = [
      block('header', 'header', 200),
      block('summary', 'summary', 100),
      expBlock('exp-0', 400),
      expBlock('exp-1', 400),
      expBlock('exp-2', 400),
      block('skills', 'skill-category', 200),
    ];

    const pages = allocatePages(blocks, twoColLayout);

    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0].layoutMode).toBe('two-column');
    expect(pages[1].layoutMode).toBe('full-width');
    // Page 2 should have experiences only
    expect(pages[1].blocks.every(pb => pb.block.type === 'experience')).toBe(true);
  });

  it('handles single-column layout sequentially', () => {
    const blocks = [
      block('header', 'header', 200),
      block('summary', 'summary', 100),
      expBlock('exp-0', 400),
      block('skills', 'skill-category', 200),
      block('edu', 'education', 150),
    ];

    const pages = allocatePages(blocks, singleColLayout);

    expect(pages[0].layoutMode).toBe('full-width');
    // All blocks should be placed sequentially
    const allPlaced = pages.flatMap(p => p.blocks);
    expect(allPlaced.length).toBeGreaterThanOrEqual(4);
  });

  it('never produces empty pages', () => {
    const blocks = [
      block('header', 'header', 200),
      block('summary', 'summary', 100),
      expBlock('exp-0', 300),
    ];

    const pages = allocatePages(blocks, twoColLayout);

    expect(pages).toHaveLength(1);
  });

  it('adds as many pages as the content needs (never truncates)', () => {
    // Create enough content to fill 3+ pages
    const blocks = [
      block('header', 'header', 200),
      block('summary', 'summary', 100),
      ...Array.from({ length: 8 }, (_, i) => expBlock(`exp-${i}`, 400)),
      block('skills', 'skill-category', 200),
    ];

    const pages = allocatePages(blocks, twoColLayout);

    expect(pages.length).toBeGreaterThan(2);
    // All experiences should be placed somewhere
    const allExpBlocks = pages.flatMap(p => p.blocks).filter(pb => pb.block.type === 'experience');
    expect(allExpBlocks.length).toBeGreaterThanOrEqual(7);
  });

  it('places sidebar blocks only on page 1 for two-column layout', () => {
    const blocks = [
      block('header', 'header', 200),
      expBlock('exp-0', 600),
      expBlock('exp-1', 600),
      block('skills', 'skill-category', 200),
      block('edu', 'education', 150),
    ];

    const pages = allocatePages(blocks, twoColLayout);

    // Only page 1 should have sidebar
    expect(pages[0].sidebarBlocks?.length).toBeGreaterThan(0);
    for (let i = 1; i < pages.length; i++) {
      expect(pages[i].sidebarBlocks ?? []).toHaveLength(0);
    }
  });

  it('handles empty experience list', () => {
    const blocks = [
      block('header', 'header', 200),
      block('skills', 'skill-category', 200),
    ];

    const pages = allocatePages(blocks, twoColLayout);

    expect(pages).toHaveLength(1);
    expect(pages[0].sidebarBlocks?.length).toBe(1);
  });

  it('flags a page holding a block taller than the page, and only that one', () => {
    const pages = allocatePages([
      block('header', 'header', 200),
      block('summary', 'summary', 1400), // taller than any page, not splittable
    ], singleColLayout);

    expect(pages.some(p => isPageOverfilled(p, singleColLayout))).toBe(true);

    const normal = allocatePages([block('header', 'header', 200), expBlock('exp-0', 400)], singleColLayout);
    expect(normal.some(p => isPageOverfilled(p, singleColLayout))).toBe(false);
  });

  it('reserves the injected section titles on single-column pages', () => {
    // Usable page ≈ 1018.6px. Without the experience and skills titles (45 + 16
    // each) the skill block would fit on page 1 with a few px to spare.
    const blocks = [
      block('header', 'header', 200),
      block('exp-0', 'experience', 400),
      block('skill-0', 'skill-category', 250),
    ];

    const pages = allocatePages(blocks, singleColLayout);

    expect(pages).toHaveLength(2);
    expect(pages[1].blocks.map(pb => pb.block.id)).toEqual(['skill-0']);
  });

  it('reserves the skills title again when skills overflow to a new page', () => {
    // The overflow page holds one 900px skill block: with its 61px title it no
    // longer leaves room for a second 60px category.
    const blocks = [
      block('header', 'header', 980),
      block('skill-0', 'skill-category', 900),
      block('skill-1', 'skill-category', 60),
    ];

    const pages = allocatePages(blocks, singleColLayout);

    expect(pages.map(p => p.blocks.map(pb => pb.block.id))).toEqual([['header'], ['skill-0'], ['skill-1']]);
  });

  it('splits experiences into slices with ABSOLUTE sub-block indices (no duplicated bullets)', () => {
    // One huge experience that cannot fit on a single page
    const blocks = [
      block('header', 'header', 200),
      expBlock('exp-0', 2400, 20), // 20 bullets of ~116px
    ];

    const pages = allocatePages(blocks, twoColLayout);

    const slices = pages
      .flatMap(p => p.blocks)
      .filter(pb => pb.block.id === 'exp-0');

    expect(slices.length).toBeGreaterThanOrEqual(2);

    // Every slice references the SAME source block (no synthetic copies)
    for (const s of slices) {
      expect(s.block.subBlocks?.length).toBe(21); // header + 20 bullets, full array preserved
    }

    // Slices tile the sub-block range contiguously without overlap
    const ranges = slices
      .map(s => [s.startSubBlock ?? 0, s.endSubBlock ?? s.block.subBlocks!.length] as const)
      .sort((a, b) => a[0] - b[0]);
    expect(ranges[0][0]).toBe(0);
    expect(ranges[ranges.length - 1][1]).toBe(21);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i][0]).toBe(ranges[i - 1][1]); // contiguous, no duplication
    }
  });
});
