import { describe, it, expect } from 'vitest';
import { mergeTemplateDefaults, TEMPLATE_DEFAULTS } from './useTemplateSelection';
import type { DesignSettings } from '@/src/shared/types';

const base: DesignSettings = {
  template: 'TEMPLATE_C',
  primaryColor: '#000',
  secondaryColor: '#fff',
  fontFamily: 'sans',
};

describe('mergeTemplateDefaults', () => {
  it('applies known template defaults + updates template id', () => {
    const out = mergeTemplateDefaults(base, 'TEMPLATE_E');
    expect(out.template).toBe('TEMPLATE_E');
    expect(out.fontFamily).toBe('outfit');
  });

  it('only updates template id for unknown template', () => {
    const out = mergeTemplateDefaults(base, 'TEMPLATE_UNKNOWN');
    expect(out.template).toBe('TEMPLATE_UNKNOWN');
    expect(out.fontFamily).toBe('sans'); // unchanged
  });

  it('preserves unrelated design fields (colors)', () => {
    const cv: DesignSettings = { ...base, primaryColor: '#ff0000', secondaryColor: '#00ff00' };
    const out = mergeTemplateDefaults(cv, 'TEMPLATE_E');
    expect(out.primaryColor).toBe('#ff0000');
    expect(out.secondaryColor).toBe('#00ff00');
  });

  it('does not mutate input', () => {
    const input = { ...base };
    const out = mergeTemplateDefaults(input, 'TEMPLATE_E');
    expect(out).not.toBe(input);
    expect(input.fontFamily).toBe('sans');
    expect(input.template).toBe('TEMPLATE_C');
  });
});

describe('TEMPLATE_DEFAULTS', () => {
  it('covers the two templates (C, E)', () => {
    expect(Object.keys(TEMPLATE_DEFAULTS)).toEqual(['TEMPLATE_C', 'TEMPLATE_E']);
  });
});
