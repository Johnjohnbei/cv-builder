import { describe, it, expect } from 'vitest';
import type { CVData } from '@/src/shared/types';
import { experienceVersionOf, versionOf, withExperienceVersion, withPersonalVersion, withVersions } from './cv-versions';

const imported: CVData = {
  personal_info: { name: 'Alex', email: 'a@b.c', title: 'Designer produit', summary: 'Designer produit en SaaS B2B. Six ans de parcours.' },
  experience: [
    { company: 'Acme', position: 'Designer', start_date: '2020', current: true, intro: 'Équipe paiement.', description: ['Conçu les maquettes'] },
    { company: 'Beta', position: 'UI', start_date: '2018', current: false, description: ['Dessiné les écrans'] },
  ],
  education: [], skills: [], languages: [],
};

const adapted: CVData = {
  ...imported,
  personal_info: { ...imported.personal_info, title: 'Product Designer', summary: 'Product designer en SaaS B2B, Figma et Node.js. Six ans de parcours.' },
  experience: [
    { ...imported.experience[0], description: ['Conçu les maquettes Figma', 'Développé en Node.js'] },
    imported.experience[1],
  ],
};

describe('withVersions', () => {
  const cv = withVersions(adapted, imported);

  it('keeps the imported text beside each one the generation changed', () => {
    expect(cv.personal_info.versions).toEqual({
      summary: { adapted: adapted.personal_info.summary, original: imported.personal_info.summary },
      title: { adapted: 'Product Designer', original: 'Designer produit' },
    });
    expect(cv.experience[0].versions).toEqual({
      adapted: { intro: 'Équipe paiement.', description: ['Conçu les maquettes Figma', 'Développé en Node.js'] },
      original: { intro: 'Équipe paiement.', description: ['Conçu les maquettes'] },
    });
  });

  it('offers no choice where the generation changed nothing', () => {
    expect(cv.experience[1].versions).toBeUndefined();
    expect(withVersions(imported, imported).personal_info.versions).toBeUndefined();
  });

  // A summary hidden because it said too little: the user can bring their own back
  it('pairs an adapted text left empty with the imported one', () => {
    const hidden = withVersions({ ...adapted, personal_info: { ...adapted.personal_info, summary: '' } }, imported);
    expect(hidden.personal_info.versions?.summary).toEqual({ adapted: '', original: imported.personal_info.summary });
  });
});

describe('choosing a version', () => {
  const cv = withVersions(adapted, imported);

  it('puts the imported text in place, then the adapted one back', () => {
    const own = withPersonalVersion(cv.personal_info, 'summary', 'original');
    expect(own.summary).toBe(imported.personal_info.summary);
    expect(versionOf(own.summary, own.versions!.summary!)).toBe('original');
    expect(withPersonalVersion(own, 'summary', 'adapted').summary).toBe(adapted.personal_info.summary);
  });

  it('switches an experience\'s intro and bullets together', () => {
    const own = withExperienceVersion(cv.experience[0], 'original');
    expect(own.description).toEqual(['Conçu les maquettes']);
    expect(experienceVersionOf(own)).toBe('original');
    expect(experienceVersionOf(cv.experience[0])).toBe('adapted');
  });

  it('reads a text the user typed in as edited, neither version', () => {
    expect(versionOf('Mon résumé à moi.', cv.personal_info.versions!.summary!)).toBe('edited');
    expect(experienceVersionOf({ ...cv.experience[0], description: ['Autre chose'] })).toBe('edited');
    expect(experienceVersionOf(cv.experience[1])).toBeNull();
  });
});
