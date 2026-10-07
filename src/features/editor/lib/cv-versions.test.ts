import { describe, it, expect } from 'vitest';
import type { CVData } from '@/src/shared/types';
import { experienceVersionOf, versionOf, withExperienceVersion, withPersonalVersion, withVersionChosen, withVersions } from './cv-versions';

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
      key: 0,
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

describe('what the user typed', () => {
  const cv = withVersions(adapted, imported);

  it('is kept as their own version when they pick another, and comes back', () => {
    const typed = { ...cv.personal_info, summary: 'Mon résumé tapé à la main.' };
    const own = withPersonalVersion(typed, 'summary', 'original');
    expect(own.summary).toBe(imported.personal_info.summary);
    expect(own.versions?.summary?.edited).toBe('Mon résumé tapé à la main.');
    expect(withPersonalVersion(own, 'summary', 'edited').summary).toBe('Mon résumé tapé à la main.');
    expect(versionOf('Mon résumé tapé à la main.', own.versions!.summary!)).toBe('edited');
  });

  it('is kept the same way for an experience', () => {
    const typed = { ...cv.experience[0], description: ['Ma puce à moi'] };
    const own = withExperienceVersion(typed, 'adapted');
    expect(own.versions?.edited?.description).toEqual(['Ma puce à moi']);
    expect(withExperienceVersion(own, 'edited').description).toEqual(['Ma puce à moi']);
  });
});

// A choice made in one language holds in the other (arbitrage of 2026-10-07)
describe('withVersionChosen', () => {
  const fr = withVersions(adapted, imported);
  const en = withVersions(
    { ...adapted, personal_info: { ...adapted.personal_info, summary: 'Product designer for B2B SaaS, Figma and Node.js. Six years.' }, experience: [{ ...adapted.experience[0], description: ['Designed Figma mockups', 'Built in Node.js'] }, adapted.experience[1]] },
    { ...imported, personal_info: { ...imported.personal_info, summary: 'Product designer in B2B SaaS. Six years.' }, experience: [{ ...imported.experience[0], description: ['Designed the mockups'] }, imported.experience[1]] },
  );
  const cv: CVData = { ...fr, _translations: { en: { personal_info: en.personal_info, experience: en.experience, education: [], skills: [], languages: [] } } };

  it('picks the same version of the summary in the cached language', () => {
    const out = withVersionChosen(cv, { field: 'summary' }, 'original');
    expect(out.personal_info.summary).toBe(imported.personal_info.summary);
    expect(out._translations?.en?.personal_info.summary).toBe('Product designer in B2B SaaS. Six years.');
  });

  // Moved in one language only, a role is found by its employer and its start date
  it('finds the same role in the cached language whatever its place', () => {
    const moved: CVData = { ...cv, experience: [cv.experience[1], cv.experience[0]] };
    const out = withVersionChosen(moved, { experience: 1 }, 'original');
    expect(out.experience[1].description).toEqual(['Conçu les maquettes']);
    expect(out._translations?.en?.experience[0].description).toEqual(['Designed the mockups']);
  });

  // Two roles at one employer from one date: only the one picked follows
  it('follows the role picked only, by its key, two roles alike or its employer edited', () => {
    const twins: CVData = {
      ...cv,
      experience: [{ ...cv.experience[0], company: 'ACME (corrigé)' }, { ...cv.experience[0], versions: { ...cv.experience[0].versions!, key: 7 } }],
      _translations: { en: { ...cv._translations!.en!, experience: [en.experience[0], { ...en.experience[0], versions: { ...en.experience[0].versions!, key: 7 } }] } },
    };
    const out = withVersionChosen(twins, { experience: 0 }, 'original');
    expect(out._translations?.en?.experience.map(exp => exp.description)).toEqual([['Designed the mockups'], ['Designed Figma mockups', 'Built in Node.js']]);
  });

  it('leaves a block the other language shows typed as it is', () => {
    const typedEn = { ...en.experience[0], description: ['My own bullet'] };
    const withTyped: CVData = { ...cv, _translations: { en: { ...cv._translations!.en!, experience: [typedEn, en.experience[1]] } } };
    const out = withVersionChosen(withTyped, { experience: 0 }, 'original');
    expect(out._translations?.en?.experience[0].description).toEqual(['My own bullet']);
  });

  it('keeps a typed version to its own language', () => {
    const typed = { ...cv, personal_info: withPersonalVersion({ ...cv.personal_info, summary: 'Mon texte.' }, 'summary', 'adapted') };
    const out = withVersionChosen(typed, { field: 'summary' }, 'edited');
    expect(out.personal_info.summary).toBe('Mon texte.');
    expect(out._translations?.en?.personal_info.summary).toBe(en.personal_info.summary);
  });
});

