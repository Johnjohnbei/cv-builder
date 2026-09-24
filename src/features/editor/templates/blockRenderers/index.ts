import type { BlockRendererMap } from '../../lib/pagination/types';
import { knownTemplateId, type TemplateId } from '../../lib/pagination/template-layouts';
import { templateCRenderers } from './template-c';
import { templateERenderers } from './template-e';

/** Registry of block renderers per template (ids owned by TEMPLATES in template-layouts.ts: a template added there without renderers fails the type check) */
const BLOCK_RENDERERS: Record<TemplateId, BlockRendererMap> = {
  TEMPLATE_C: templateCRenderers,
  TEMPLATE_E: templateERenderers,
};

/** A removed or unknown template renders like the template it opens in */
export function getBlockRenderers(templateId: string): BlockRendererMap {
  return BLOCK_RENDERERS[knownTemplateId(templateId)];
}
