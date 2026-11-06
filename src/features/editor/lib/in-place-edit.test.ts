import { describe, it, expect } from 'vitest';
import type { CVData } from '@/src/shared/types';
import { applyEdit } from './in-place-edit';

const CV: CVData = {
  personal_info: { name: 'Alex', email: 'a@b.c', title: 'Designer produit', summary: 'Six ans en SaaS B2B.' },
  experience: [
    {
      company: 'Acme', position: 'Designer', start_date: '2020', current: true,
      intro: 'Équipe paiement.', kpi: '+12 % de conversion',
      description: ['Conçu les maquettes', 'Mesuré les parcours'],
    },
    { company: 'Beta', position: 'UI', start_date: '2018', current: false, description: ['Dessiné les écrans'] },
  ],
  education: [], languages: [],
  skills: [{ category: 'tools', items: ['Figma', 'Sketch'] }],
};

describe('applyEdit: the preview writes in the CV, never in the rendered text', () => {
  it('writes the header title and the summary', () => {
    expect(applyEdit(CV, { kind: 'title' }, 'Product Designer').personal_info.title).toBe('Product Designer');
    expect(applyEdit(CV, { kind: 'summary' }, ' Huit ans. ').personal_info.summary).toBe('Huit ans.');
  });

  it('writes a position, a company, an intro and a KPI of the experience clicked, and only that one', () => {
    const withPosition = applyEdit(CV, { kind: 'position', experience: 1 }, 'UI Designer');
    expect(withPosition.experience[1].position).toBe('UI Designer');
    expect(withPosition.experience[0]).toBe(CV.experience[0]);
    expect(applyEdit(CV, { kind: 'company', experience: 0 }, 'Acme SAS').experience[0].company).toBe('Acme SAS');
    expect(applyEdit(CV, { kind: 'intro', experience: 0 }, 'Équipe facturation.').experience[0].intro).toBe('Équipe facturation.');
    expect(applyEdit(CV, { kind: 'kpi', experience: 0 }, '+20 %').experience[0].kpi).toBe('+20 %');
  });

  it('replaces the bullet it showed, wherever that bullet is stored', () => {
    const edited = applyEdit(CV, { kind: 'bullet', experience: 0, was: 'Mesuré les parcours' }, 'Mesuré 4 parcours');
    expect(edited.experience[0].description).toEqual(['Conçu les maquettes', 'Mesuré 4 parcours']);
  });

  it('empties a bullet by taking it out, rather than printing an empty line', () => {
    expect(applyEdit(CV, { kind: 'bullet', experience: 0, was: 'Conçu les maquettes' }, '   ').experience[0].description)
      .toEqual(['Mesuré les parcours']);
  });

  // A printed bullet can come from the imported version of the experience
  it('adds the edit when the text shown is not one the CV stores', () => {
    const edited = applyEdit(CV, { kind: 'bullet', experience: 1, was: 'Dessiné les maquettes' }, 'Dessiné 12 écrans');
    expect(edited.experience[1].description).toEqual(['Dessiné les écrans', 'Dessiné 12 écrans']);
  });

  it('replaces a skill in its own category, found by the category key', () => {
    const edited = applyEdit(CV, { kind: 'skill', category: 'tools', was: 'Sketch' }, 'Framer');
    expect(edited.skills[0].items).toEqual(['Figma', 'Framer']);
    expect(applyEdit(CV, { kind: 'skill', category: 'absent', was: 'Sketch' }, 'Framer')).toBe(CV);
  });

  it('returns the same CV when the text did not change, so nothing is saved or undone', () => {
    expect(applyEdit(CV, { kind: 'title' }, 'Designer produit')).toBe(CV);
    expect(applyEdit(CV, { kind: 'bullet', experience: 0, was: 'Conçu les maquettes' }, 'Conçu les maquettes')).toBe(CV);
    expect(applyEdit(CV, { kind: 'position', experience: 9 }, 'Fantôme')).toBe(CV);
  });
});
