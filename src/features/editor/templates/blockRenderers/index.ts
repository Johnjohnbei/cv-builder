import type { BlockRendererMap } from '../../lib/pagination/types';
import { templateCRenderers } from './templateC';
import { templateERenderers } from './templateE';

/**
 * Registry of block renderers per template. The two-column templates A
 * (Classic) and B (Modern) were removed on 2026-09-15 (arbitrage Q3): a CV
 * still carrying their id renders in Elegant.
 */
const BLOCK_RENDERERS: Record<string, BlockRendererMap> = {
  TEMPLATE_C: templateCRenderers,
  TEMPLATE_E: templateERenderers,
};

export function getBlockRenderers(templateId: string): BlockRendererMap {
  return BLOCK_RENDERERS[templateId] ?? templateERenderers;
}
