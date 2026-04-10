import type { BlockRendererMap } from '../../lib/pagination/types';
import { templateARenderers } from './templateA';

/**
 * Registry of block renderers per template.
 * Each template provides renderers for all block types.
 * Templates not yet migrated fall back to TemplateA renderers.
 */
const BLOCK_RENDERERS: Record<string, BlockRendererMap> = {
  TEMPLATE_A: templateARenderers,
  // TODO: Phase 7 — add B, C, D, E, F renderers
  TEMPLATE_B: templateARenderers,
  TEMPLATE_C: templateARenderers,
  TEMPLATE_D: templateARenderers,
  TEMPLATE_E: templateARenderers,
  TEMPLATE_F: templateARenderers,
};

export function getBlockRenderers(templateId: string): BlockRendererMap {
  return BLOCK_RENDERERS[templateId] ?? templateARenderers;
}
