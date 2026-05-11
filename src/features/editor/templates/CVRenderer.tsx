import { memo } from 'react';
import type { TemplateProps } from './shared';
import { TemplateA } from './TemplateA';
import { TemplateB } from './TemplateB';
import { TemplateC } from './TemplateC';
import { TemplateE } from './TemplateE';

const TEMPLATE_MAP: Record<string, React.ComponentType<TemplateProps>> = {
  TEMPLATE_A: TemplateA,
  TEMPLATE_B: TemplateB,
  TEMPLATE_C: TemplateC,
  TEMPLATE_E: TemplateE,
};

interface Props extends TemplateProps {
  selectedTemplate: string;
}

/**
 * CVRenderer — memoized to skip re-renders when only sidebar UI state changes.
 * Only re-renders when cvData, designSettings, or selectedTemplate change.
 * Falls back to TemplateA for legacy/unknown template ids (DB migration safety).
 */
export const CVRenderer = memo(function CVRenderer({ selectedTemplate, ...templateProps }: Props) {
  const Template = TEMPLATE_MAP[selectedTemplate] ?? TemplateA;
  return <Template {...templateProps} />;
});
