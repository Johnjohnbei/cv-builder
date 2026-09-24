// ─── Page Allocation Algorithm ───
// Pure function: distributes measured blocks across pages.
// Overflow travels as PlacedBlock slices with ABSOLUTE sub-block indices —
// the same block object flows through every page, so live DOM measurements
// (keyed by block id) always reconcile back to the source block.

import type {
  ContentBlock,
  PageAssignment,
  PlacedBlock,
  TemplateLayout,
} from './types';
import { A4_HEIGHT_MM, MEASUREMENT_SAFETY_PX, SECTION_TITLE_HEIGHT_PX } from './types';
import { splitBlock, getPlacedBlockHeight } from './split-block';

// ─── Helpers ───

/** Convert mm to px at 96dpi (1mm ≈ 3.7795px) */
const MM_TO_PX = 3.7795;

function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}

function getUsableHeight(paddingTopMm: number, paddingBottomMm: number): number {
  return mmToPx(A4_HEIGHT_MM - paddingTopMm - paddingBottomMm);
}

/**
 * Whether a page was given more than it can hold. Allocation never truncates:
 * a block taller than a page (a summary of several thousand characters) is
 * still placed, and its bottom is cut by the page edge in the PDF. This is the
 * signal the editor needs to warn about it.
 */
export function isPageOverfilled(page: PageAssignment, layout: TemplateLayout): boolean {
  const padding = page.pageIndex === 0 ? layout.page1 : layout.page2Plus;
  return page.usedHeightPx > getUsableHeight(padding.paddingTopMm, padding.paddingBottomMm) + 1;
}

// ─── Options ───

/**
 * Optional overrides for live-measured heights.
 * usePaginationFit reads these from the real rendered DOM and passes them here,
 * replacing the previously-hardcoded SECTION_TITLE_HEIGHT_PX constant.
 */
export interface AllocateOptions {
  /** Height of injected section titles, in pixels, per section type */
  sectionTitleHeights?: {
    experience?: number;
    skills?: number;
  };
}

interface TitleHeights {
  experience: number;
  skills: number;
}

function resolveTitles(options: AllocateOptions): TitleHeights {
  return {
    experience: options.sectionTitleHeights?.experience ?? SECTION_TITLE_HEIGHT_PX,
    skills: options.sectionTitleHeights?.skills ?? SECTION_TITLE_HEIGHT_PX,
  };
}

/**
 * Space PaginatedCV adds above the first experience and the first skill
 * category of a page, for its section title. Zero once that title is already
 * on the page, and for untitled block types. Titles are separate siblings in
 * the DOM, so no measured block height includes them.
 */
function titleReserve(type: ContentBlock['type'], titled: Set<string>, titles: TitleHeights): number {
  if (titled.has(type)) return 0;
  if (type === 'experience') return titles.experience + MEASUREMENT_SAFETY_PX;
  if (type === 'skill-category') return titles.skills + MEASUREMENT_SAFETY_PX;
  return 0;
}

/**
 * Height a page really takes: its blocks plus the section titles injected
 * above them. MEASUREMENT_SAFETY_PX is the CSS gap between blocks, and the
 * last block has none: a block placed by force that fitted within that gap
 * was reported as cut.
 */
function usedHeight(blocks: PlacedBlock[], titles: TitleHeights): number {
  const titled = new Set<string>();
  const withGaps = blocks.reduce((sum, pb) => {
    const titleH = titleReserve(pb.block.type, titled, titles);
    titled.add(pb.block.type);
    return sum + titleH + getPlacedBlockHeight(pb) + MEASUREMENT_SAFETY_PX;
  }, 0);
  return blocks.length > 0 ? withGaps - MEASUREMENT_SAFETY_PX : 0;
}

// ─── Main Algorithm ───

const ORDER: ContentBlock['type'][] = ['header', 'summary', 'experience', 'skill-category', 'education', 'languages'];

/**
 * Allocate blocks to pages, in reading order: header, summary, experiences,
 * skills, education, languages.
 *
 * - Blocks that don't fit are split at bullet level when possible.
 * - Never truncates: adds as many pages as the content needs.
 */
export function allocatePages(
  blocks: ContentBlock[],
  layout: TemplateLayout,
  options: AllocateOptions = {},
): PageAssignment[] {
  const titles = resolveTitles(options);
  const ordered = ORDER.flatMap(type => blocks.filter(b => b.type === type));

  const pages: PageAssignment[] = [];
  const page1Blocks: PlacedBlock[] = [];
  const overflow = fillPage(ordered, getUsableHeight(layout.page1.paddingTopMm, layout.page1.paddingBottomMm), page1Blocks, titles);
  pages.push({ pageIndex: 0, blocks: page1Blocks, usedHeightPx: usedHeight(page1Blocks, titles) });

  if (overflow.length > 0) {
    const page2Height = getUsableHeight(layout.page2Plus.paddingTopMm, layout.page2Plus.paddingBottomMm);
    allocateOverflowPages(overflow, page2Height, pages, titles);
  }
  return pages;
}

// ─── Page Filling ───

/**
 * Fill the first page with blocks until no more fit.
 * Returns the overflow as PlacedBlock slices (whole blocks or split remainders).
 */
function fillPage(
  blocks: ContentBlock[],
  availablePx: number,
  placed: PlacedBlock[],
  titles: TitleHeights,
): PlacedBlock[] {
  let usedPx = 0;
  const titled = new Set<string>();
  const overflow: PlacedBlock[] = [];
  let overflowStarted = false;

  for (const block of blocks) {
    if (overflowStarted) {
      overflow.push({ block });
      continue;
    }

    const titleH = titleReserve(block.type, titled, titles);
    const remaining = availablePx - usedPx - titleH;

    // Block fits entirely
    if (block.heightPx + MEASUREMENT_SAFETY_PX <= remaining) {
      placed.push({ block });
      usedPx += block.heightPx + MEASUREMENT_SAFETY_PX + titleH;
      titled.add(block.type);
      continue;
    }

    // Try to split
    if (block.splittable) {
      const split = splitBlock(block, remaining);
      if (split) {
        placed.push(split.kept);
        overflow.push(split.overflow);
        overflowStarted = true;
        continue;
      }
    }

    // Can't fit or split — overflow the entire block
    overflow.push({ block });
    overflowStarted = true;
  }

  return overflow;
}

/**
 * Allocate overflow slices across additional pages.
 * A slice that doesn't fit is split again (from its own start offset).
 */
function allocateOverflowPages(
  overflow: PlacedBlock[],
  pageHeightPx: number,
  pages: PageAssignment[],
  titles: TitleHeights,
): void {
  let remaining = [...overflow];

  while (remaining.length > 0) {
    const pageBlocks: PlacedBlock[] = [];
    const nextOverflow: PlacedBlock[] = [];
    const titled = new Set<string>();
    let usedPx = 0;
    let overflowStarted = false;

    for (const pb of remaining) {
      if (overflowStarted) {
        nextOverflow.push(pb);
        continue;
      }

      const height = getPlacedBlockHeight(pb);
      const titleH = titleReserve(pb.block.type, titled, titles);
      const space = pageHeightPx - usedPx - titleH;

      if (height + MEASUREMENT_SAFETY_PX <= space) {
        pageBlocks.push(pb);
        usedPx += height + MEASUREMENT_SAFETY_PX + titleH;
        titled.add(pb.block.type);
        continue;
      }

      // Try split (from the slice's own start offset)
      if (pb.block.splittable) {
        const split = splitBlock(pb.block, space, pb.startSubBlock ?? 0);
        if (split) {
          pageBlocks.push(split.kept);
          nextOverflow.push(split.overflow);
          overflowStarted = true;
          continue;
        }
      }

      // If no blocks placed yet on this page, force-place to avoid infinite loop
      if (pageBlocks.length === 0) {
        pageBlocks.push(pb);
        usedPx += height + titleH;
        titled.add(pb.block.type);
        overflowStarted = true;
        continue;
      }

      nextOverflow.push(pb);
      overflowStarted = true;
    }

    pages.push({ pageIndex: pages.length, blocks: pageBlocks, usedHeightPx: usedHeight(pageBlocks, titles) });
    remaining = nextOverflow;
  }
}
