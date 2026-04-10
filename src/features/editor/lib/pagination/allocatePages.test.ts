import { describe, it, expect } from 'vitest';
import { allocatePages } from './allocatePages';
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

/** A4 usable height ≈ (297 - 16.9 - 10.6) * 3.7795 ≈ 1018px */
const PAGE_USABLE_PX = Math.round((297 - 16.9 - 10.6) * 3.7795);

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

    const pages = allocatePages(blocks, twoColLayout, 1);

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

    const pages = allocatePages(blocks, twoColLayout, 2);

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

    const pages = allocatePages(blocks, singleColLayout, 2);

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

    const pages = allocatePages(blocks, twoColLayout, 3);

    // Even with pageLimit=3, should only produce 1 page if content fits
    expect(pages).toHaveLength(1);
  });

  it('adds pages beyond pageLimit rather than truncating', () => {
    // Create enough content to fill 3+ pages
    const blocks = [
      block('header', 'header', 200),
      block('summary', 'summary', 100),
      ...Array.from({ length: 8 }, (_, i) => expBlock(`exp-${i}`, 400)),
      block('skills', 'skill-category', 200),
    ];

    const pages = allocatePages(blocks, twoColLayout, 2);

    // Should have more than 2 pages since content overflows
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

    const pages = allocatePages(blocks, twoColLayout, 2);

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

    const pages = allocatePages(blocks, twoColLayout, 1);

    expect(pages).toHaveLength(1);
    expect(pages[0].sidebarBlocks?.length).toBe(1);
  });
});
