// ─── Templates: the registry and their layout dimensions ───
// Derived from the Tailwind classes of each template: the page padding p-16 is
// 64px ≈ 16.9mm on every side. Both templates are single-column since the
// two-column templates A (Classic) and B (Modern) were removed on 2026-09-15
// (arbitrage Q3).

import { DEFAULT_DESIGN, type DesignSettings } from '@/src/shared/types';
import type { TemplateLayout } from './types';

/** The templates offered, in display order: the single owner of their ids and names */
export const TEMPLATES = [
  { id: 'TEMPLATE_C', name: 'Minimal', description: 'Sérieux & Professionnel' },
  { id: 'TEMPLATE_E', name: 'Elegant', description: 'Haut de gamme' },
] as const;

/** Standard padding (p-16 = 64px ≈ 16.9mm) */
const PAD_16 = 16.9;

const SINGLE_COLUMN: TemplateLayout = {
  page1: { paddingTopMm: PAD_16, paddingBottomMm: PAD_16 },
  page2Plus: { paddingTopMm: PAD_16, paddingBottomMm: PAD_16 },
};

export type TemplateId = (typeof TEMPLATES)[number]['id'];

export const TEMPLATE_LAYOUTS: Record<TemplateId, TemplateLayout> = { TEMPLATE_C: SINGLE_COLUMN, TEMPLATE_E: SINGLE_COLUMN };

/**
 * The template a CV renders in: a removed or unknown id (TEMPLATE_A, TEMPLATE_B)
 * opens in the default. Looked up in the registry, not as an object key: an id
 * such as "constructor" read the object's prototype and crashed the pagination.
 */
export function knownTemplateId(templateId: string | undefined): TemplateId {
  return TEMPLATES.find(t => t.id === templateId)?.id ?? (DEFAULT_DESIGN.template as TemplateId);
}

/** The name shown for a stored template id, a removed one read as the template it opens in */
export function templateName(templateId: string | undefined): string {
  const id = knownTemplateId(templateId);
  return TEMPLATES.find(t => t.id === id)!.name;
}

/**
 * The design of a stored CV as the editor uses it: a removed template opens in
 * the default, and the "Mode ATS" flag (removed on 2026-09-15) is dropped, so
 * the next save writes neither and stored documents clean themselves up.
 */
export function migratedDesign(design: DesignSettings & { atsMode?: unknown }): DesignSettings {
  const { atsMode: _removed, ...rest } = design;
  return { ...rest, template: knownTemplateId(rest.template) };
}

export function getTemplateLayout(templateId: string): TemplateLayout {
  return TEMPLATE_LAYOUTS[knownTemplateId(templateId)];
}
