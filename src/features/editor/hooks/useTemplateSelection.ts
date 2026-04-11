import { useCallback, useState } from 'react';
import type { DesignSettings } from '@/src/shared/types';
import { TEMPLATE_ATS_COMPAT, ATS_FALLBACK_TEMPLATE } from '@/src/features/editor/lib/atsRules';

// ─── Template defaults ───

export const TEMPLATE_DEFAULTS: Record<string, Partial<DesignSettings>> = {
  TEMPLATE_A: { fontFamily: 'sans', sectionTitleWeight: 'bold', sectionTitleSpacing: 'widest', sectionTitleTransform: 'uppercase' },
  TEMPLATE_B: { fontFamily: 'sans', sectionTitleWeight: 'semibold', sectionTitleSpacing: 'normal', sectionTitleTransform: 'uppercase' },
  TEMPLATE_C: { fontFamily: 'serif', sectionTitleWeight: 'normal', sectionTitleSpacing: 'normal', sectionTitleTransform: 'uppercase' },
  TEMPLATE_D: { fontFamily: 'playfair', sectionTitleWeight: 'black', sectionTitleSpacing: 'tight', sectionTitleTransform: 'none' },
  TEMPLATE_E: { fontFamily: 'outfit', sectionTitleWeight: 'medium', sectionTitleSpacing: 'wide', sectionTitleTransform: 'uppercase' },
  TEMPLATE_F: { fontFamily: 'sans', sectionTitleWeight: 'bold', sectionTitleSpacing: 'wider', sectionTitleTransform: 'uppercase' },
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
  selectedTemplate: string;
  setSelectedTemplate: (id: string) => void;
  designSettings: DesignSettings;
  setDesignSettings: (updater: (prev: DesignSettings) => DesignSettings) => void;
  notify: (args: { message: string; type: 'success' | 'error' }) => void;
}

export interface UseTemplateSelectionResult {
  pendingTemplate: string | null;
  showTemplateConfirm: boolean;
  requestTemplateChange: (templateId: string) => void;
  confirmTemplateChange: () => void;
  cancelTemplateChange: () => void;
  setAtsMode: (enabled: boolean) => void;
}

// ─── Hook ───

/**
 * Owns template switching + ATS-mode side effects.
 *
 * Template switch flow:
 *   1. requestTemplateChange(id) → sets pendingTemplate + opens confirm modal
 *   2. User confirms → confirmTemplateChange() applies defaults
 *   3. User cancels → cancelTemplateChange() discards
 *
 * ATS mode flow:
 *   - Enabling on an incompatible template auto-switches to ATS_FALLBACK_TEMPLATE
 *     and remembers the previous template via preAtsTemplate
 *   - Disabling restores preAtsTemplate if one was saved
 */
export function useTemplateSelection(
  deps: UseTemplateSelectionDeps,
): UseTemplateSelectionResult {
  const { selectedTemplate, setSelectedTemplate, setDesignSettings, notify } = deps;
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const [preAtsTemplate, setPreAtsTemplate] = useState<string | null>(null);

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

  const setAtsMode = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        const compat = TEMPLATE_ATS_COMPAT[selectedTemplate];
        if (compat === 'limited') {
          setPreAtsTemplate(selectedTemplate);
          setSelectedTemplate(ATS_FALLBACK_TEMPLATE);
          setDesignSettings(prev => ({
            ...prev,
            atsMode: true,
            template: ATS_FALLBACK_TEMPLATE,
          }));
          notify({
            message: 'Template incompatible ATS — basculé vers Classic',
            type: 'success',
          });
        } else {
          setDesignSettings(prev => ({ ...prev, atsMode: true }));
        }
      } else {
        if (preAtsTemplate) {
          setSelectedTemplate(preAtsTemplate);
          setDesignSettings(prev => ({
            ...prev,
            atsMode: false,
            template: preAtsTemplate,
          }));
          setPreAtsTemplate(null);
        } else {
          setDesignSettings(prev => ({ ...prev, atsMode: false }));
        }
        notify({
          message: 'Mode ATS désactivé — le CV ne sera plus optimisé ATS',
          type: 'error',
        });
      }
    },
    [selectedTemplate, setSelectedTemplate, setDesignSettings, preAtsTemplate, notify],
  );

  return {
    pendingTemplate,
    showTemplateConfirm,
    requestTemplateChange,
    confirmTemplateChange,
    cancelTemplateChange,
    setAtsMode,
  };
}
