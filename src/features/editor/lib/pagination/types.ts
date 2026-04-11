// ─── Pagination Layout Engine — Type Definitions ───

import type { Experience, SkillCategory, Education, Language, PersonalInfo } from '@/src/shared/types';

// ─── Block Types ───

export type BlockType = 'header' | 'summary' | 'experience' | 'skill-category' | 'education' | 'languages';

export type SubBlockType = 'exp-header' | 'bullet' | 'kpi' | 'skill-title' | 'skill-row';

export interface SubBlock {
  id: string;
  heightPx: number;
  type: SubBlockType;
}

/**
 * A measurable content block — the atomic unit of the pagination engine.
 * Each block has a measured height at two widths (main column + full width)
 * and optional sub-blocks for splitting across pages.
 */
export interface ContentBlock {
  id: string;
  type: BlockType;
  /** Measured height at page-1 main column width */
  heightPx: number;
  /** Measured height at full-width (pages 2+) */
  fullWidthHeightPx: number;
  /** Can this block be split across pages? */
  splittable: boolean;
  /** Sub-blocks for split calculation (bullets, skill items) */
  subBlocks?: SubBlock[];
  /** Reference to the source data */
  data: Experience | SkillCategory | Education[] | Language[] | PersonalInfo | string;
}

// ─── Page Assignment ───

export type LayoutMode = 'two-column' | 'full-width';

export interface PlacedBlock {
  block: ContentBlock;
  /** For split blocks: start sub-block index (inclusive) */
  startSubBlock?: number;
  /** For split blocks: end sub-block index (exclusive) */
  endSubBlock?: number;
}

export interface PageAssignment {
  pageIndex: number;
  blocks: PlacedBlock[];
  /** Sidebar blocks (only on page 0 for two-column layouts) */
  sidebarBlocks?: PlacedBlock[];
  layoutMode: LayoutMode;
  usedHeightPx: number;
}

// ─── Template Layout Dimensions ───

export type TemplateLayoutType = 'two-column-right' | 'two-column-left' | 'single-column';

export interface PageDimensions {
  contentWidthMm: number;
  paddingTopMm: number;
  paddingBottomMm: number;
  paddingLeftMm: number;
  paddingRightMm: number;
}

export interface Page1Dimensions extends PageDimensions {
  mainColumnWidthMm: number;
  sidebarWidthMm: number;
  gapMm: number;
}

export interface TemplateLayout {
  type: TemplateLayoutType;
  /** Page 1 has header + optional two-column layout */
  page1: Page1Dimensions;
  /** Pages 2+ are full-width with accent color */
  page2Plus: PageDimensions;
  /** Header spans full width above grid (true for A/D/C/E, false for B/F where header is in sidebar) */
  headerFullWidth: boolean;
}

// ─── Constants ───

/** A4 page height in mm */
export const A4_HEIGHT_MM = 297;
/** A4 page width in mm */
export const A4_WIDTH_MM = 210;
/** Minimum sub-blocks to keep on current page before splitting */
export const MIN_KEEP_SUB_BLOCKS = 2;
/** Inter-block gap in px — matches CSS space-y-4 (16px) used in CVPage columns */
export const MEASUREMENT_SAFETY_PX = 16;
/** Injected section title height in px (text-sm ~20px + pb-2 8px + border 1px + mb-4 16px) */
export const SECTION_TITLE_HEIGHT_PX = 45;

// ─── Block Renderer Interface ───

export interface BlockRendererProps {
  block: PlacedBlock;
  designSettings: import('@/src/shared/types').DesignSettings;
  language: 'fr' | 'en';
  isPage2Plus?: boolean;
}

export type BlockRenderer = (props: BlockRendererProps) => React.ReactNode;

export interface BlockRendererMap {
  header: BlockRenderer;
  summary: BlockRenderer;
  experience: BlockRenderer;
  'skill-category': BlockRenderer;
  education: BlockRenderer;
  languages: BlockRenderer;
}
