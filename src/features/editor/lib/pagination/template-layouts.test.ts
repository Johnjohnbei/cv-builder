import { describe, it, expect } from 'vitest';
import { knownTemplateId, migratedDesign, templateName } from './template-layouts';
import type { DesignSettings } from '@/src/shared/types';

const design: DesignSettings = { template: 'TEMPLATE_C', primaryColor: '#000', secondaryColor: '#fff', fontFamily: 'sans' };

describe('knownTemplateId', () => {
  // "constructor" once read the registry object's prototype and crashed the pagination
  it.each(['TEMPLATE_A', 'TEMPLATE_B', 'TEMPLATE_X', 'constructor', 'toString', undefined])('opens %s in Elegant', (id) => {
    expect(knownTemplateId(id)).toBe('TEMPLATE_E');
  });

  it('keeps the two templates offered', () => {
    expect(knownTemplateId('TEMPLATE_C')).toBe('TEMPLATE_C');
    expect(knownTemplateId('TEMPLATE_E')).toBe('TEMPLATE_E');
  });
});

describe('templateName', () => {
  it('names a removed template as the one it opens in', () => {
    expect(templateName('TEMPLATE_B')).toBe('Elegant');
    expect(templateName('TEMPLATE_C')).toBe('Minimal');
  });
});

// Stored before 2026-09-15: the next save must write neither the removed template nor the ATS mode
describe('migratedDesign', () => {
  it('opens a removed template in Elegant and drops the ATS mode flag, the rest kept', () => {
    const stored = { ...design, template: 'TEMPLATE_A', atsMode: true, pageLimit: 1 };
    expect(migratedDesign(stored)).toEqual({ ...design, template: 'TEMPLATE_E', pageLimit: 1 });
  });
});
