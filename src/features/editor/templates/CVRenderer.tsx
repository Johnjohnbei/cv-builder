import { memo } from 'react';
import type { TemplateProps } from './shared';
import { TemplateA } from './TemplateA';
import { TemplateB } from './TemplateB';
import { TemplateC } from './TemplateC';
import { TemplateD } from './TemplateD';
import { TemplateE } from './TemplateE';
import { TemplateF } from './TemplateF';

const TEMPLATE_MAP: Record<string, React.ComponentType<TemplateProps>> = {
  TEMPLATE_A: TemplateA,
  TEMPLATE_B: TemplateB,
  TEMPLATE_C: TemplateC,
  TEMPLATE_D: TemplateD,
  TEMPLATE_E: TemplateE,
  TEMPLATE_F: TemplateF,
};

interface Props extends TemplateProps {
  selectedTemplate: string;
}

/**
 * CVRenderer — memoized to skip re-renders when only sidebar UI state changes.
 * Only re-renders when cvData, designSettings, or selectedTemplate change.
 */
export const CVRenderer = memo(function CVRenderer({ selectedTemplate, ...templateProps }: Props) {
  const Template = TEMPLATE_MAP[selectedTemplate];
  if (Template) return <Template {...templateProps} />;
  return null;
});
