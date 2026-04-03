import type { TemplateProps } from './shared';
import { TemplateA } from './TemplateA';

// Templates B-F will be extracted progressively.
// For now they use the legacy render path in EditorPage.
// This router is used by the legacy code to delegate to extracted templates.

const TEMPLATE_MAP: Record<string, React.ComponentType<TemplateProps>> = {
  TEMPLATE_A: TemplateA,
};

interface Props extends TemplateProps {
  selectedTemplate: string;
  /** Legacy fallback renderer for templates not yet extracted */
  legacyRender?: () => React.ReactNode;
}

export function CVRenderer({ selectedTemplate, legacyRender, ...templateProps }: Props) {
  const Template = TEMPLATE_MAP[selectedTemplate];
  
  if (Template) {
    return <Template {...templateProps} />;
  }
  
  // Fallback to legacy inline renderer
  if (legacyRender) {
    return <>{legacyRender()}</>;
  }
  
  return null;
}
