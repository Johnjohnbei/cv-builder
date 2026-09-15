import type { BlockRendererMap } from '../../lib/pagination/types';
import { knownTemplateId } from '../../lib/pagination/templateLayouts';
import { templateCRenderers } from './templateC';
import { templateERenderers } from './templateE';

/** Registry of block renderers per template (ids owned by TEMPLATES in templateLayouts.ts) */
const BLOCK_RENDERERS: Record<string, BlockRendererMap> = {
  TEMPLATE_C: templateCRenderers,
  TEMPLATE_E: templateERenderers,
};

/** A removed or unknown template renders like the template it opens in */
export function getBlockRenderers(templateId: string): BlockRendererMap {
  return BLOCK_RENDERERS[knownTemplateId(templateId)];
}
