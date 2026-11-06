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
  /**
   * For an experience block: the role's index in `cvData.experience`, which
   * `id` does not give (it counts the visible roles only). An edit made in the
   * preview writes at this index.
   */
  sourceIndex?: number;
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
/** Minimum sub-blocks to keep on current page before splitting */
export const MIN_KEEP_SUB_BLOCKS = 2;
/**
 * Minimum sub-blocks to carry over. The rule existed on the kept side only, so
 * a role of three bullets cut after the second sent ONE bullet to open the next
 * page, under a rule with no owner.
 */
export const MIN_OVERFLOW_SUB_BLOCKS = 2;
/** Inter-block gap in px — matches CSS gap-3 (12px) used in CVPage */
export const MEASUREMENT_SAFETY_PX = 12;
/**
 * Injected section title height in px: text-sm ~20px + pb-2 8px + border 1px.
 * It read 45, counting an mb-4 that PaginatedCV says it does not render
 * ("NOTE: no mb-4"): 16px over-reserved per injected title at the first paint,
 * which the live measurement then corrected, after showing a page that was not
 * needed.
 */
export const SECTION_TITLE_HEIGHT_PX = 29;

// ─── Block Renderer Interface ───

export interface BlockRendererProps {
  block: PlacedBlock;
  designSettings: import('@/src/shared/types').DesignSettings;
  language: 'fr' | 'en';
  isPage2Plus?: boolean;
  /**
   * Set in the editor's preview only: the texts become editable where they are
   * read. Absent when the CV is printed, exported or drawn as a thumbnail, so
   * those render exactly the same DOM as before.
   */
  editing?: import('../in-place-edit').InPlaceEditing;
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
