import type { BlockRendererMap } from '../../lib/pagination/types';
import { templateARenderers } from './templateA';
import { templateBRenderers } from './templateB';
import { templateCRenderers } from './templateC';
import { templateDRenderers } from './templateD';
import { templateERenderers } from './templateE';
import { templateFRenderers } from './templateF';

/**
 * Registry of block renderers per template.
 * Each template provides renderers for all block types.
 */
const BLOCK_RENDERERS: Record<string, BlockRendererMap> = {
  TEMPLATE_A: templateARenderers,
  TEMPLATE_B: templateBRenderers,
  TEMPLATE_C: templateCRenderers,
  TEMPLATE_D: templateDRenderers,
  TEMPLATE_E: templateERenderers,
  TEMPLATE_F: templateFRenderers,
};

export function getBlockRenderers(templateId: string): BlockRendererMap {
  return BLOCK_RENDERERS[templateId] ?? templateARenderers;
}
