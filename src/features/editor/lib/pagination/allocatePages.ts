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

interface TitleHeights {
  experience: number;
  skills: number;
}

function resolveTitles(options: AllocateOptions): TitleHeights {
  return {
    experience: resolveTitleH(options.sectionTitleHeights?.experience),
    skills: resolveTitleH(options.sectionTitleHeights?.skills),
  };
}

/**
 * Space PaginatedCV adds above the first experience and the first skill
 * category of a page, for its section title. Zero once that title is already
 * on the page, and for untitled block types.
 *
 * Titles are separate siblings in the DOM, so no measured block height
 * includes them. Only page 1 of two-column templates used to reserve them:
 * single-column pages (Elegant is the default) and every page 2+ were
 * allocated one title short and could clip their last block.
 */
function titleReserve(type: ContentBlock['type'], titled: Set<string>, titles: TitleHeights): number {
  if (titled.has(type)) return 0;
  if (type === 'experience') return titles.experience + MEASUREMENT_SAFETY_PX;
  if (type === 'skill-category') return titles.skills + MEASUREMENT_SAFETY_PX;
  return 0;
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
  const titles = resolveTitles(options);
  const skillsTitleH = titles.skills;

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

  // Main column: fill with experiences (fillColumn reserves their section title)
  const overflowExperiences = fillColumn(experiences, page1Height, page1Main, titles);

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
    allocateOverflowPages(allOverflow, page2Height, pages, true, titles);
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
  options: AllocateOptions,
): PageAssignment[] {
  const pages: PageAssignment[] = [];
  const page1Height = getUsableHeight(layout.page1.paddingTopMm, layout.page1.paddingBottomMm);
  const titles = resolveTitles(options);

  // All blocks flow sequentially: header → summary → experiences → skills → edu → languages
  const allBlocks: ContentBlock[] = [];
  if (header) allBlocks.push(header);
  if (summary) allBlocks.push(summary);
  allBlocks.push(...experiences);
  allBlocks.push(...sidebarBlocks);

  const page1Blocks: PlacedBlock[] = [];
  const overflow = fillColumn(allBlocks, page1Height, page1Blocks, titles);

  const page1Total = page1Blocks.reduce((sum, pb) => sum + getPlacedBlockHeight(pb) + MEASUREMENT_SAFETY_PX, 0);

  pages.push({
    pageIndex: 0,
    blocks: page1Blocks,
    layoutMode: 'full-width',
    usedHeightPx: page1Total,
  });

  if (overflow.length > 0) {
    const page2Height = getUsableHeight(layout.page2Plus.paddingTopMm, layout.page2Plus.paddingBottomMm);
    allocateOverflowPages(overflow, page2Height, pages, false, titles);
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
  titles: TitleHeights,
): PlacedBlock[] {
  let usedPx = placed.reduce((sum, pb) => sum + getPlacedBlockHeight(pb) + MEASUREMENT_SAFETY_PX, 0);
  const titled = new Set<string>(placed.map(pb => pb.block.type));
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
  useFullWidthHeight: boolean,
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

      const height = placedHeight(pb, useFullWidthHeight);
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
