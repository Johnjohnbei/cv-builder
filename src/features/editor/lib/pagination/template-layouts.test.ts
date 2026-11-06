import { describe, it, expect } from 'vitest';
import { knownTemplateId, migratedDesign } from './template-layouts';
import type { DesignSettings } from '@/src/shared/types';

const design: DesignSettings = { template: 'TEMPLATE_E', primaryColor: '#000', secondaryColor: '#fff', fontFamily: 'sans' };

describe('knownTemplateId', () => {
  // "constructor" once read the registry object's prototype and crashed the pagination
  // TEMPLATE_C was removed on 2026-11-06: its profile title printed with 0.3em
  // of letter-spacing, which Chrome writes one token per letter in the PDF
  it.each(['TEMPLATE_A', 'TEMPLATE_B', 'TEMPLATE_C', 'TEMPLATE_X', 'constructor', 'toString', undefined])('opens %s in Elegant', (id) => {
    expect(knownTemplateId(id)).toBe('TEMPLATE_E');
  });

  it('keeps the template offered', () => {
    expect(knownTemplateId('TEMPLATE_E')).toBe('TEMPLATE_E');
  });
});

// Stored before 2026-09-15: the next save must write neither the removed template nor the ATS mode
describe('migratedDesign', () => {
  it('opens a removed template in Elegant and drops the ATS mode flag, the rest kept', () => {
    const stored = { ...design, template: 'TEMPLATE_A', atsMode: true, pageLimit: 1 };
    expect(migratedDesign(stored)).toEqual({ ...design, template: 'TEMPLATE_E', pageLimit: 1 });
  });
});
