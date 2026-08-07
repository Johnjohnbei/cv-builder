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

/** Height of a placed block in the requested width context. Slices always sum their sub-blocks. */
function placedHeight(pb: PlacedBlock, useFullWidth: boolean): number {
  if (pb.startSubBlock === undefined || pb.endSubBlock === undefined || !pb.block.subBlocks) {
    return useFullWidth ? pb.block.fullWidthHeightPx : pb.block.heightPx;
  }
  return getPlacedBlockHeight(pb);
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

function resolveTitleH(override: number | undefined): number {
  return override ?? SECTION_TITLE_HEIGHT_PX;
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
 * - Pages 2+: full-width (with accent color border).
 * - Blocks that don't fit are split at bullet level when possible.
 * - Never truncates: adds as many pages as the content needs.
 */
export function allocatePages(
  blocks: ContentBlock[],
  layout: TemplateLayout,
  options: AllocateOptions = {},
): PageAssignment[] {
  const { header, summary, experiences, sidebarBlocks } = classifyBlocks(blocks);
  const isTwoColumn = layout.type !== 'single-column';

  if (isTwoColumn) {
    return allocateTwoColumn(header, summary, experiences, sidebarBlocks, layout, options);
  }
  return allocateSingleColumn(header, summary, experiences, sidebarBlocks, layout, options);
}

// ─── Two-Column Layout (Templates A, B) ───

function allocateTwoColumn(
  header: ContentBlock | null,
  summary: ContentBlock | null,
  experiences: ContentBlock[],
  sidebarBlocks: ContentBlock[],
  layout: TemplateLayout,
  options: AllocateOptions,
): PageAssignment[] {
  const pages: PageAssignment[] = [];
  const page1Height = getUsableHeight(layout.page1.paddingTopMm, layout.page1.paddingBottomMm);
  const expTitleH = resolveTitleH(options.sectionTitleHeights?.experience);
  const skillsTitleH = resolveTitleH(options.sectionTitleHeights?.skills);

  // ─── Page 1: Header + Main Column + Sidebar ───

  const page1Main: PlacedBlock[] = [];
  const page1Sidebar: PlacedBlock[] = [];

  // Header (spans full width above grid, or is in sidebar for B)
  if (header) {
    if (layout.headerFullWidth) {
      page1Main.push({ block: header });
    } else {
      page1Sidebar.push({ block: header });
    }
  }

  // Summary (always in main column)
  if (summary) {
    page1Main.push({ block: summary });
  }

  // Sidebar: fill with skills/education/languages
  // Blocks that don't fit flow to page 2+ as full-width content
  const sidebarOverflow: PlacedBlock[] = [];
  const headerSidebarH = layout.headerFullWidth ? 0 : (header?.heightPx ?? 0);
  let sidebarUsed = headerSidebarH;
  // Reserve space for the "COMPÉTENCES" section title injected by PaginatedCV
  const hasSkills = sidebarBlocks.some(b => b.type === 'skill-category');
  if (hasSkills) {
    sidebarUsed += skillsTitleH + MEASUREMENT_SAFETY_PX;
  }
  for (const sb of sidebarBlocks) {
    if (sidebarUsed + sb.heightPx + MEASUREMENT_SAFETY_PX <= page1Height) {
      page1Sidebar.push({ block: sb });
      sidebarUsed += sb.heightPx + MEASUREMENT_SAFETY_PX;
    } else {
      sidebarOverflow.push({ block: sb });
    }
  }

  // Main column: fill with experiences
  // Subtract space for the "EXPÉRIENCE PROFESSIONNELLE" section title injected by PaginatedCV
  const mainAvailable = experiences.length > 0 ? page1Height - expTitleH - MEASUREMENT_SAFETY_PX : page1Height;
  const overflowExperiences = fillColumn(experiences, mainAvailable, page1Main);

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
    // Reserve space for the "(suite)" section title on page 2+ (only for experience overflow)
    const continuationTitleH = overflowExperiences.length > 0 ? expTitleH + MEASUREMENT_SAFETY_PX : 0;
    allocateOverflowPages(allOverflow, page2Height - continuationTitleH, pages, true);
  }

  return pages;
}

// ─── Single-Column Layout (Templates C, E) ───
// Every page renders at the same full width, so heightPx is the single source
// of truth (usePaginationFit keeps heightPx === fullWidthHeightPx here).

function allocateSingleColumn(
  header: ContentBlock | null,
  summary: ContentBlock | null,
  experiences: ContentBlock[],
  sidebarBlocks: ContentBlock[],
  layout: TemplateLayout,
  _options: AllocateOptions,
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
 * Returns the overflow as PlacedBlock slices (whole blocks or split remainders).
 */
function fillColumn(
  blocks: ContentBlock[],
  availablePx: number,
  placed: PlacedBlock[],
): PlacedBlock[] {
  let usedPx = placed.reduce((sum, pb) => sum + getPlacedBlockHeight(pb) + MEASUREMENT_SAFETY_PX, 0);
  const overflow: PlacedBlock[] = [];
  let overflowStarted = false;

  for (const block of blocks) {
    if (overflowStarted) {
      overflow.push({ block });
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
  useFullWidthHeight: boolean,
): void {
  let remaining = [...overflow];

  while (remaining.length > 0) {
    const pageBlocks: PlacedBlock[] = [];
    const nextOverflow: PlacedBlock[] = [];
    let usedPx = 0;
    let overflowStarted = false;

    for (const pb of remaining) {
      if (overflowStarted) {
        nextOverflow.push(pb);
        continue;
      }

      const height = placedHeight(pb, useFullWidthHeight);
      const space = pageHeightPx - usedPx;

      if (height + MEASUREMENT_SAFETY_PX <= space) {
        pageBlocks.push(pb);
        usedPx += height + MEASUREMENT_SAFETY_PX;
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
        usedPx += height;
        overflowStarted = true;
        continue;
      }

      nextOverflow.push(pb);
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
