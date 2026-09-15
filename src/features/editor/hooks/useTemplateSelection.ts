import { useCallback, useState } from 'react';
import type { DesignSettings } from '@/src/shared/types';

// ─── Template defaults ───

export const TEMPLATE_DEFAULTS: Record<string, Partial<DesignSettings>> = {
  TEMPLATE_C: { fontFamily: 'serif' },
  TEMPLATE_E: { fontFamily: 'outfit' },
};

// ─── Pure helpers (exported for unit tests) ───

/**
 * Merge the template-specific defaults into an existing design settings object.
 * Returns a fresh object — never mutates.
 * Unknown template ids pass through with only the template field updated.
 */
export function mergeTemplateDefaults(
  current: DesignSettings,
  templateId: string,
): DesignSettings {
  const defaults = TEMPLATE_DEFAULTS[templateId];
  if (!defaults) return { ...current, template: templateId };
  return { ...current, ...defaults, template: templateId };
}

// ─── Types ───

export interface UseTemplateSelectionDeps {
  setSelectedTemplate: (id: string) => void;
  setDesignSettings: (updater: (prev: DesignSettings) => DesignSettings) => void;
}

export interface UseTemplateSelectionResult {
  pendingTemplate: string | null;
  showTemplateConfirm: boolean;
  requestTemplateChange: (templateId: string) => void;
  confirmTemplateChange: () => void;
  cancelTemplateChange: () => void;
}

// ─── Hook ───

/**
 * Owns template switching:
 *   1. requestTemplateChange(id) → sets pendingTemplate + opens confirm modal
 *   2. User confirms → confirmTemplateChange() applies defaults
 *   3. User cancels → cancelTemplateChange() discards
 *
 * The "Mode ATS" toggle is gone (arbitrage Q4, 2026-09-15): both remaining
 * templates are read in order by an ATS, the export needs no special mode.
 */
export function useTemplateSelection(
  deps: UseTemplateSelectionDeps,
): UseTemplateSelectionResult {
  const { setSelectedTemplate, setDesignSettings } = deps;
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);

  const requestTemplateChange = useCallback((templateId: string) => {
    setPendingTemplate(templateId);
    setShowTemplateConfirm(true);
  }, []);

  const confirmTemplateChange = useCallback(() => {
    if (!pendingTemplate) return;
    setDesignSettings(prev => mergeTemplateDefaults(prev, pendingTemplate));
    setSelectedTemplate(pendingTemplate);
    setPendingTemplate(null);
    setShowTemplateConfirm(false);
  }, [pendingTemplate, setDesignSettings, setSelectedTemplate]);

  const cancelTemplateChange = useCallback(() => {
    setShowTemplateConfirm(false);
    setPendingTemplate(null);
  }, []);

  return {
    pendingTemplate,
    showTemplateConfirm,
    requestTemplateChange,
    confirmTemplateChange,
    cancelTemplateChange,
  };
}
