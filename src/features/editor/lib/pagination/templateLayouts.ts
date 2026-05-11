// ─── Template Layout Dimensions ───
// Derived from actual Tailwind classes in each template.
// 210mm ≈ 794px at 96dpi. 1rem = 16px. Tailwind spacing: p-12=48px, p-16=64px.
// Conversions: 64px ≈ 16.9mm, 48px ≈ 12.7mm, gap-12=48px ≈ 12.7mm, gap-16=64px ≈ 16.9mm
//
// All templates use symmetric safety margins (pt == pb) — uniform breathing room
// on every side of the page. Templates using p-16 → 16.9mm; templates using p-12 → 12.7mm.

import type { TemplateLayout } from './types';

// ─── Shared constants ───

/** Standard padding (p-16 = 64px ≈ 16.9mm) */
const PAD_16 = 16.9;
/** Smaller padding (p-12 = 48px ≈ 12.7mm) */
const PAD_12 = 12.7;
/** Gap between grid columns (gap-12 = 48px ≈ 12.7mm) */
const GAP_12 = 12.7;

// ─── Per-Template Layouts ───

/**
 * TemplateA — Classic (sidebar right)
 * Root: px-16 pt-16 pb-10
 * Grid: grid-cols-3 gap-12 (main=2fr, sidebar=1fr)
 * Main column ≈ (210 - 2*16.9 - 12.7) * 2/3 = ~109mm
 * Sidebar ≈ ~54mm
 */
const TEMPLATE_A: TemplateLayout = {
  type: 'two-column-right',
  page1: {
    contentWidthMm: 210 - 2 * PAD_16,
    mainColumnWidthMm: (210 - 2 * PAD_16 - GAP_12) * (2 / 3),
    sidebarWidthMm: (210 - 2 * PAD_16 - GAP_12) * (1 / 3),
    gapMm: GAP_12,
    paddingTopMm: PAD_16,
    paddingBottomMm: PAD_16,
    paddingLeftMm: PAD_16,
    paddingRightMm: PAD_16,
  },
  page2Plus: {
    contentWidthMm: 210 - 2 * PAD_16,
    paddingTopMm: PAD_16,
    paddingBottomMm: PAD_16,
    paddingLeftMm: PAD_16,
    paddingRightMm: PAD_16,
  },
  headerFullWidth: true,
};

/**
 * TemplateB — Modern (sidebar left, bg primary)
 * Left sidebar: p-12, width=1fr
 * Right main: p-16, width=2fr
 * Grid: grid-cols-[1fr_2fr]
 */
const TEMPLATE_B: TemplateLayout = {
  type: 'two-column-left',
  page1: {
    contentWidthMm: 210,
    mainColumnWidthMm: 210 * (2 / 3),
    sidebarWidthMm: 210 * (1 / 3),
    gapMm: 0,
    paddingTopMm: PAD_12,
    paddingBottomMm: PAD_12,
    paddingLeftMm: 0,
    paddingRightMm: 0,
  },
  page2Plus: {
    contentWidthMm: 210 - 2 * PAD_16,
    paddingTopMm: PAD_16,
    paddingBottomMm: PAD_16,
    paddingLeftMm: PAD_16,
    paddingRightMm: PAD_16,
  },
  headerFullWidth: false,
};

/**
 * TemplateC — Minimal (single column, centered)
 * Root: px-16 pt-16 pb-10 space-y-8
 * Skills/edu in grid-cols-2 below experiences
 */
const TEMPLATE_C: TemplateLayout = {
  type: 'single-column',
  page1: {
    contentWidthMm: 210 - 2 * PAD_16,
    mainColumnWidthMm: 210 - 2 * PAD_16,
    sidebarWidthMm: 0,
    gapMm: 0,
    paddingTopMm: PAD_16,
    paddingBottomMm: PAD_16,
    paddingLeftMm: PAD_16,
    paddingRightMm: PAD_16,
  },
  page2Plus: {
    contentWidthMm: 210 - 2 * PAD_16,
    paddingTopMm: PAD_16,
    paddingBottomMm: PAD_16,
    paddingLeftMm: PAD_16,
    paddingRightMm: PAD_16,
  },
  headerFullWidth: true,
};

/**
 * TemplateE — Elegant (single column, skills/edu grid)
 * Root: px-16 pt-16 pb-10
 * Skills/edu: grid-cols-2 gap-12
 */
const TEMPLATE_E: TemplateLayout = {
  type: 'single-column',
  page1: {
    contentWidthMm: 210 - 2 * PAD_16,
    mainColumnWidthMm: 210 - 2 * PAD_16,
    sidebarWidthMm: 0,
    gapMm: 0,
    paddingTopMm: PAD_16,
    paddingBottomMm: PAD_16,
    paddingLeftMm: PAD_16,
    paddingRightMm: PAD_16,
  },
  page2Plus: {
    contentWidthMm: 210 - 2 * PAD_16,
    paddingTopMm: PAD_16,
    paddingBottomMm: PAD_16,
    paddingLeftMm: PAD_16,
    paddingRightMm: PAD_16,
  },
  headerFullWidth: true,
};

// ─── Registry ───

export const TEMPLATE_LAYOUTS: Record<string, TemplateLayout> = {
  TEMPLATE_A: TEMPLATE_A,
  TEMPLATE_B: TEMPLATE_B,
  TEMPLATE_C: TEMPLATE_C,
  TEMPLATE_E: TEMPLATE_E,
};

export function getTemplateLayout(templateId: string): TemplateLayout {
  return TEMPLATE_LAYOUTS[templateId] ?? TEMPLATE_A;
}
