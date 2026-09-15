// ─── Pagination Layout Engine — Type Definitions ───

import type { Experience, SkillCategory, Education, Language, PersonalInfo } from '@/src/shared/types';

// ─── Block Types ───

export type BlockType = 'header' | 'summary' | 'experience' | 'skill-category' | 'education' | 'languages';

export type SubBlockType = 'exp-header' | 'bullet' | 'kpi';

export interface SubBlock {
  id: string;
  heightPx: number;
  type: SubBlockType;
}

/**
 * A measurable content block — the atomic unit of the pagination engine.
 * Every page renders at the same width (single-column templates only), so one
 * measured height is enough; sub-blocks allow splitting across pages.
 */
export interface ContentBlock {
  id: string;
  type: BlockType;
  /** Measured height at the page's content width */
  heightPx: number;
  /** Can this block be split across pages? */
  splittable: boolean;
  /** Sub-blocks for split calculation (experience header + bullets) */
  subBlocks?: SubBlock[];
  /** Reference to the source data */
  data: Experience | SkillCategory | Education[] | Language[] | PersonalInfo | string;
}

// ─── Page Assignment ───

export interface PlacedBlock {
  block: ContentBlock;
  /** For split blocks: start sub-block index (inclusive, ABSOLUTE into block.subBlocks) */
  startSubBlock?: number;
  /** For split blocks: end sub-block index (exclusive, ABSOLUTE into block.subBlocks) */
  endSubBlock?: number;
}

export interface PageAssignment {
  pageIndex: number;
  blocks: PlacedBlock[];
  usedHeightPx: number;
}

// ─── Template Layout Dimensions ───

export interface PageDimensions {
  paddingTopMm: number;
  paddingBottomMm: number;
}

export interface TemplateLayout {
  page1: PageDimensions;
  /** Pages 2+ carry an accent border */
  page2Plus: PageDimensions;
}

// ─── Constants ───

/** A4 page height in mm */
export const A4_HEIGHT_MM = 297;
/** A4 page width in mm */
export const A4_WIDTH_MM = 210;
/** Minimum sub-blocks to keep on current page before splitting */
export const MIN_KEEP_SUB_BLOCKS = 2;
/** Inter-block gap in px — matches CSS gap-4 (16px) used in CVPage */
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
