// ─── Template Layout Dimensions ───
// Derived from the Tailwind classes of each template: the page padding p-16 is
// 64px ≈ 16.9mm on every side. Both templates are single-column since the
// two-column templates A (Classic) and B (Modern) were removed on 2026-09-15
// (arbitrage Q3).

import { DEFAULT_DESIGN } from '@/src/shared/types';
import type { TemplateLayout } from './types';

/** Standard padding (p-16 = 64px ≈ 16.9mm) */
const PAD_16 = 16.9;

const SINGLE_COLUMN: TemplateLayout = {
  page1: { paddingTopMm: PAD_16, paddingBottomMm: PAD_16 },
  page2Plus: { paddingTopMm: PAD_16, paddingBottomMm: PAD_16 },
};

export const TEMPLATE_LAYOUTS: Record<string, TemplateLayout> = {
  /** Minimal: single column, centered */
  TEMPLATE_C: SINGLE_COLUMN,
  /** Elegant: single column, the default */
  TEMPLATE_E: SINGLE_COLUMN,
};

/** The template a CV renders in: a removed or unknown id (TEMPLATE_A, TEMPLATE_B) opens in the default */
export function knownTemplateId(templateId: string | undefined): string {
  return templateId && TEMPLATE_LAYOUTS[templateId] ? templateId : DEFAULT_DESIGN.template;
}

export function getTemplateLayout(templateId: string): TemplateLayout {
  return TEMPLATE_LAYOUTS[knownTemplateId(templateId)];
}
