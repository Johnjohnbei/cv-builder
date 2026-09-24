import { describe, it, expect } from 'vitest';
import { allocatePages, isPageOverfilled } from './allocate-pages';
import type { ContentBlock, TemplateLayout } from './types';

// ─── Test Layout: usable page ≈ (297 - 16.9 - 10.6) mm ≈ 1018.6px ───

const layout: TemplateLayout = {
  page1: { paddingTopMm: 16.9, paddingBottomMm: 10.6 },
  page2Plus: { paddingTopMm: 16.9, paddingBottomMm: 10.6 },
};

// ─── Helpers ───

function block(id: string, type: ContentBlock['type'], heightPx: number, splittable = false): ContentBlock {
  return { id, type, heightPx, splittable, data: {} as never };
}

function expBlock(id: string, totalHeight: number, bulletCount = 3): ContentBlock {
  const bulletHeight = Math.floor((totalHeight - 80) / bulletCount);
  return {
    id,
    type: 'experience',
    heightPx: totalHeight,
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

const ids = (pages: ReturnType<typeof allocatePages>) => pages.map(p => p.blocks.map(pb => pb.block.id));

// ─── Tests ───

describe('allocatePages', () => {
  it('places everything on page 1 when content fits', () => {
    const pages = allocatePages([
      block('header', 'header', 200),
      block('summary', 'summary', 100),
      expBlock('exp-0', 300),
      block('skills', 'skill-category', 150),
    ], layout);

    expect(ids(pages)).toEqual([['header', 'summary', 'exp-0', 'skills']]);
  });

  it('lays blocks out in reading order, whatever order they come in', () => {
    const pages = allocatePages([
      block('langs', 'languages', 50),
      block('skills', 'skill-category', 50),
      block('header', 'header', 100),
      expBlock('exp-0', 200),
      block('edu', 'education', 50),
    ], layout);

    expect(ids(pages)).toEqual([['header', 'exp-0', 'skills', 'edu', 'langs']]);
  });

  it('overflows to page 2 when page 1 is full', () => {
    const pages = allocatePages([
      block('header', 'header', 200),
      block('summary', 'summary', 100),
      expBlock('exp-0', 400),
      expBlock('exp-1', 400),
      expBlock('exp-2', 400),
      block('skills', 'skill-category', 200),
    ], layout);

    expect(pages.length).toBeGreaterThanOrEqual(2);
    // Page 2 goes on with the experiences, the skills come after them
    expect(pages[1].blocks[0].block.type).toBe('experience');
    expect(pages.at(-1)!.blocks.at(-1)!.block.id).toBe('skills');
  });

  it('adds as many pages as the content needs (never truncates)', () => {
    const pages = allocatePages([
      block('header', 'header', 200),
      ...Array.from({ length: 8 }, (_, i) => expBlock(`exp-${i}`, 400)),
      block('skills', 'skill-category', 200),
    ], layout);

    expect(pages.length).toBeGreaterThan(2);
    const placed = new Set(pages.flatMap(p => p.blocks.map(pb => pb.block.id)));
    expect(placed.size).toBe(10);
    expect(pages.every(p => p.blocks.length > 0)).toBe(true);
  });

  it('flags a page holding a block taller than the page, and only that one', () => {
    const pages = allocatePages([
      block('header', 'header', 200),
      block('summary', 'summary', 1400), // taller than any page, not splittable
    ], layout);
    expect(pages.some(p => isPageOverfilled(p, layout))).toBe(true);

    const normal = allocatePages([block('header', 'header', 200), expBlock('exp-0', 400)], layout);
    expect(normal.some(p => isPageOverfilled(p, layout))).toBe(false);
  });

  it('counts the injected title when a block is forced onto a page', () => {
    // Page 2 holds one 980px skill block placed by force: 980 + 16 fits the
    // usable ≈ 1018.6px alone, not under its 45 + 16px title, so the PDF cuts it.
    const pages = allocatePages([
      block('header', 'header', 980),
      block('skill-0', 'skill-category', 980),
    ], layout);

    expect(ids(pages)).toEqual([['header'], ['skill-0']]);
    expect(isPageOverfilled(pages[0], layout)).toBe(false);
    expect(isPageOverfilled(pages[1], layout)).toBe(true);
  });

  it('does not flag a block forced onto a page that it really fits (no gap after the last block)', () => {
    // 950 + 16 gap does not fit under the 61px title (≈ 957.6px left), so the
    // block is forced; 61 + 950 = 1011px does fit the ≈ 1018.6px page.
    const pages = allocatePages([
      block('header', 'header', 980),
      block('skill-0', 'skill-category', 950),
    ], layout);

    expect(ids(pages)).toEqual([['header'], ['skill-0']]);
    expect(pages.some(p => isPageOverfilled(p, layout))).toBe(false);
  });

  it('reserves the injected section titles', () => {
    // Without the experience and skills titles (45 + 16 each) the skill block
    // would fit on page 1 with a few px to spare.
    const pages = allocatePages([
      block('header', 'header', 200),
      block('exp-0', 'experience', 400),
      block('skill-0', 'skill-category', 250),
    ], layout);

    expect(ids(pages)).toEqual([['header', 'exp-0'], ['skill-0']]);
  });

  it('reserves the skills title again when skills overflow to a new page', () => {
    // The overflow page holds one 900px skill block: with its 61px title it no
    // longer leaves room for a second 60px category.
    const pages = allocatePages([
      block('header', 'header', 980),
      block('skill-0', 'skill-category', 900),
      block('skill-1', 'skill-category', 60),
    ], layout);

    expect(ids(pages)).toEqual([['header'], ['skill-0'], ['skill-1']]);
  });

  it('splits experiences into slices with ABSOLUTE sub-block indices (no duplicated bullets)', () => {
    const pages = allocatePages([
      block('header', 'header', 200),
      expBlock('exp-0', 2400, 20), // 20 bullets of ~116px
    ], layout);

    const slices = pages.flatMap(p => p.blocks).filter(pb => pb.block.id === 'exp-0');
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
