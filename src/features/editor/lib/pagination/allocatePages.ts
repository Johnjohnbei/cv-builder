// ─── Page Allocation Algorithm ───
// Pure function: distributes measured blocks across pages.

import type {
  ContentBlock,
  PageAssignment,
  PlacedBlock,
  TemplateLayout,
} from './types';
import { A4_HEIGHT_MM, MEASUREMENT_SAFETY_PX } from './types';
import { splitBlock, getPlacedBlockHeight } from './splitBlock';

// ─── Helpers ───

/** Convert mm to px at 96dpi (1mm ≈ 3.7795px) */
const MM_TO_PX = 3.7795;

function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}

function getUsableHeight(paddingTopMm: number, paddingBottomMm: number): number {
  return mmToPx(A4_HEIGHT_MM - paddingTopMm - paddingBottomMm);
}

// ─── Block Classification ───

interface ClassifiedBlocks {
  header: ContentBlock | null;
  summary: ContentBlock | null;
  experiences: ContentBlock[];
  sidebarBlocks: ContentBlock[];  // skills, education, languages
}

function classifyBlocks(blocks: ContentBlock[]): ClassifiedBlocks {
  return {
    header: blocks.find(b => b.type === 'header') ?? null,
    summary: blocks.find(b => b.type === 'summary') ?? null,
    experiences: blocks.filter(b => b.type === 'experience'),
    sidebarBlocks: blocks.filter(b =>
      b.type === 'skill-category' || b.type === 'education' || b.type === 'languages',
    ),
  };
}

// ─── Main Algorithm ───

/**
 * Allocate blocks to pages.
 *
 * - Page 1: two-column for sidebar templates (header + summary + experiences in main,
 *   skills/edu/languages in sidebar). Single-column templates put everything sequentially.
 * - Pages 2+: full-width, experiences only (with accent color border).
 * - Blocks that don't fit are split at bullet/item level when possible.
 * - Never truncates: adds pages if content exceeds pageLimit.
 */
export function allocatePages(
  blocks: ContentBlock[],
  layout: TemplateLayout,
  _pageLimit: number,
): PageAssignment[] {
  const { header, summary, experiences, sidebarBlocks } = classifyBlocks(blocks);
  const isTwoColumn = layout.type !== 'single-column';

  if (isTwoColumn) {
    return allocateTwoColumn(header, summary, experiences, sidebarBlocks, layout);
  }
  return allocateSingleColumn(header, summary, experiences, sidebarBlocks, layout);
}

// ─── Two-Column Layout (Templates A, B, D, F) ───

function allocateTwoColumn(
  header: ContentBlock | null,
  summary: ContentBlock | null,
  experiences: ContentBlock[],
  sidebarBlocks: ContentBlock[],
  layout: TemplateLayout,
): PageAssignment[] {
  const pages: PageAssignment[] = [];
  const page1Height = getUsableHeight(layout.page1.paddingTopMm, layout.page1.paddingBottomMm);

  // ─── Page 1: Header + Main Column + Sidebar ───

  let mainUsed = 0;
  const page1Main: PlacedBlock[] = [];
  const page1Sidebar: PlacedBlock[] = [];

  // Header (spans full width above grid, or is in sidebar for B/F)
  if (header) {
    if (layout.headerFullWidth) {
      page1Main.push({ block: header });
      mainUsed += header.heightPx + MEASUREMENT_SAFETY_PX;
    } else {
      page1Sidebar.push({ block: header });
    }
  }

  // Summary (always in main column)
  if (summary) {
    page1Main.push({ block: summary });
    mainUsed += summary.heightPx + MEASUREMENT_SAFETY_PX;
  }

  // Sidebar: fill with skills/education/languages
  // Blocks that don't fit flow to page 2+ as full-width content
  const sidebarOverflow: ContentBlock[] = [];
  let sidebarUsed = layout.headerFullWidth ? 0 : (header?.heightPx ?? 0);
  for (const sb of sidebarBlocks) {
    if (sidebarUsed + sb.heightPx + MEASUREMENT_SAFETY_PX <= page1Height) {
      page1Sidebar.push({ block: sb });
      sidebarUsed += sb.heightPx + MEASUREMENT_SAFETY_PX;
    } else {
      sidebarOverflow.push(sb);
    }
  }

  // Main column: fill with experiences
  // Note: fillColumn calculates usedPx from already-placed blocks in page1Main
  const overflowExperiences = fillColumn(experiences, page1Height, page1Main);

  // Determine effective page 1 height
  const mainTotal = page1Main.reduce((sum, pb) => sum + getPlacedBlockHeight(pb) + MEASUREMENT_SAFETY_PX, 0);
  const sideTotal = page1Sidebar.reduce((sum, pb) => sum + getPlacedBlockHeight(pb) + MEASUREMENT_SAFETY_PX, 0);

  pages.push({
    pageIndex: 0,
    blocks: page1Main,
    sidebarBlocks: page1Sidebar,
    layoutMode: 'two-column',
    usedHeightPx: Math.max(mainTotal, sideTotal),
  });

  // ─── Pages 2+: Full-width overflow (experiences + sidebar overflow) ───

  const allOverflow = [...overflowExperiences, ...sidebarOverflow];
  if (allOverflow.length > 0) {
    const page2Height = getUsableHeight(layout.page2Plus.paddingTopMm, layout.page2Plus.paddingBottomMm);
    allocateOverflowPages(allOverflow, page2Height, pages, true);
  }

  return pages;
}

// ─── Single-Column Layout (Templates C, E) ───

function allocateSingleColumn(
  header: ContentBlock | null,
  summary: ContentBlock | null,
  experiences: ContentBlock[],
  sidebarBlocks: ContentBlock[],
  layout: TemplateLayout,
): PageAssignment[] {
  const pages: PageAssignment[] = [];
  const page1Height = getUsableHeight(layout.page1.paddingTopMm, layout.page1.paddingBottomMm);

  // All blocks flow sequentially: header → summary → experiences → skills → edu → languages
  const allBlocks: ContentBlock[] = [];
  if (header) allBlocks.push(header);
  if (summary) allBlocks.push(summary);
  allBlocks.push(...experiences);
  allBlocks.push(...sidebarBlocks);

  const page1Blocks: PlacedBlock[] = [];
  const overflow = fillColumn(allBlocks, page1Height, page1Blocks);

  const page1Total = page1Blocks.reduce((sum, pb) => sum + getPlacedBlockHeight(pb) + MEASUREMENT_SAFETY_PX, 0);

  pages.push({
    pageIndex: 0,
    blocks: page1Blocks,
    layoutMode: 'full-width',
    usedHeightPx: page1Total,
  });

  if (overflow.length > 0) {
    const page2Height = getUsableHeight(layout.page2Plus.paddingTopMm, layout.page2Plus.paddingBottomMm);
    allocateOverflowPages(overflow, page2Height, pages, false);
  }

  return pages;
}

// ─── Column Filling ───

/**
 * Fill a column with blocks until no more fit.
 * Returns the overflow (blocks that didn't fit, including split remainders).
 */
function fillColumn(
  blocks: ContentBlock[],
  availablePx: number,
  placed: PlacedBlock[],
): ContentBlock[] {
  let usedPx = placed.reduce((sum, pb) => sum + getPlacedBlockHeight(pb) + MEASUREMENT_SAFETY_PX, 0);
  const overflow: ContentBlock[] = [];
  let overflowStarted = false;

  for (const block of blocks) {
    if (overflowStarted) {
      overflow.push(block);
      continue;
    }

    const remaining = availablePx - usedPx;

    // Block fits entirely
    if (block.heightPx + MEASUREMENT_SAFETY_PX <= remaining) {
      placed.push({ block });
      usedPx += block.heightPx + MEASUREMENT_SAFETY_PX;
      continue;
    }

    // Try to split
    if (block.splittable) {
      const split = splitBlock(block, remaining);
      if (split) {
        placed.push(split.kept);
        // Create a synthetic block for the overflow portion
        overflow.push(createOverflowBlock(split.overflow));
        overflowStarted = true;
        continue;
      }
    }

    // Can't fit or split — overflow the entire block
    overflow.push(block);
    overflowStarted = true;
  }

  return overflow;
}

/**
 * Allocate overflow blocks across additional pages.
 */
function allocateOverflowPages(
  overflow: ContentBlock[],
  pageHeightPx: number,
  pages: PageAssignment[],
  useFullWidthHeight: boolean,
): void {
  let remaining = [...overflow];

  while (remaining.length > 0) {
    const pageBlocks: PlacedBlock[] = [];
    const nextOverflow: ContentBlock[] = [];
    let usedPx = 0;
    let overflowStarted = false;

    for (const block of remaining) {
      if (overflowStarted) {
        nextOverflow.push(block);
        continue;
      }

      const height = useFullWidthHeight ? block.fullWidthHeightPx : block.heightPx;
      const space = pageHeightPx - usedPx;

      if (height + MEASUREMENT_SAFETY_PX <= space) {
        pageBlocks.push({ block });
        usedPx += height + MEASUREMENT_SAFETY_PX;
        continue;
      }

      // Try split
      if (block.splittable) {
        const split = splitBlock(block, space);
        if (split) {
          pageBlocks.push(split.kept);
          nextOverflow.push(createOverflowBlock(split.overflow));
          overflowStarted = true;
          continue;
        }
      }

      // If no blocks placed yet on this page, force-place to avoid infinite loop
      if (pageBlocks.length === 0) {
        pageBlocks.push({ block });
        usedPx += height;
        overflowStarted = true;
        continue;
      }

      nextOverflow.push(block);
      overflowStarted = true;
    }

    const pageTotal = pageBlocks.reduce((sum, pb) => sum + getPlacedBlockHeight(pb) + MEASUREMENT_SAFETY_PX, 0);

    pages.push({
      pageIndex: pages.length,
      blocks: pageBlocks,
      layoutMode: 'full-width',
      usedHeightPx: pageTotal,
    });

    remaining = nextOverflow;
  }
}

// ─── Utilities ───

/**
 * Create a synthetic ContentBlock from a split overflow PlacedBlock.
 * This represents the "remaining" portion of a split block.
 */
function createOverflowBlock(placed: PlacedBlock): ContentBlock {
  const { block, startSubBlock, endSubBlock } = placed;

  if (startSubBlock === undefined || endSubBlock === undefined || !block.subBlocks) {
    return block;
  }

  const overflowSubs = block.subBlocks.slice(startSubBlock, endSubBlock);
  const overflowHeight = overflowSubs.reduce((sum, s) => sum + s.heightPx, 0) + MEASUREMENT_SAFETY_PX;

  return {
    ...block,
    id: `${block.id}-overflow`,
    heightPx: overflowHeight,
    fullWidthHeightPx: overflowHeight, // approximate — will be re-measured if needed
    subBlocks: overflowSubs,
  };
}
