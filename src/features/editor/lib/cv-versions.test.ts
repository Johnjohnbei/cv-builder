import { describe, it, expect } from 'vitest';
import type { CVData } from '@/src/shared/types';
import {
  adaptedTextsOf, experienceVersionOf, importedTextsOf, typedTextsOf, versionOf, withExperienceVersion,
  withPersonalVersion, withTranslatedVersions, withVersions,
} from './cv-versions';

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

// A lazy translation rebuilds the versions in the new language, block by block.
// Each translation call marks its texts its own way, as two model calls do.
describe('withTranslatedVersions', () => {
  const cv = withVersions(adapted, imported);
  const translated = (mark: string) => (source: CVData): CVData => ({
    ...source,
    personal_info: {
      ...source.personal_info, versions: undefined,
      summary: source.personal_info.summary && `${mark} ${source.personal_info.summary}`,
      title: source.personal_info.title && `${mark} ${source.personal_info.title}`,
    },
    experience: source.experience.map(exp => ({ ...exp, versions: undefined, intro: exp.intro && `${mark} ${exp.intro}`, description: exp.description.map(b => `${mark} ${b}`) })),
  });
  const rebuild = (source: CVData) => withTranslatedVersions(
    source, translated('T')(typedTextsOf(source)), translated('I')(importedTextsOf(source)), translated('A')(adaptedTextsOf(source)),
  );

  it('shows each block in the translation of the version it showed, so that version reads back', () => {
    const picked: CVData = { ...cv, personal_info: withPersonalVersion(cv.personal_info, 'summary', 'original') };
    const out = rebuild(picked);
    expect(out.personal_info.summary).toBe(`I ${imported.personal_info.summary}`);
    expect(versionOf(out.personal_info.summary, out.personal_info.versions!.summary!)).toBe('original');
    expect(experienceVersionOf(out.experience[0])).toBe('adapted');
    expect(out.experience[0].description).toEqual(['A Conçu les maquettes Figma', 'A Développé en Node.js']);
  });

  it('keeps what the user typed, shown or not', () => {
    const typed = { ...cv.personal_info, summary: 'Mon résumé tapé.' };
    const back = withPersonalVersion(typed, 'summary', 'adapted');
    const out = rebuild({ ...cv, personal_info: back });
    expect(out.personal_info.versions?.summary?.edited).toBe('T Mon résumé tapé.');
    expect(versionOf(out.personal_info.summary, out.personal_info.versions!.summary!)).toBe('adapted');

    const shownTyped = rebuild({ ...cv, experience: [{ ...cv.experience[0], description: ['Ma puce'] }, cv.experience[1]] });
    expect(experienceVersionOf(shownTyped.experience[0])).toBe('edited');
    expect(shownTyped.experience[0].description).toEqual(['T Ma puce']);
  });

  // Two translations of one text may differ: no choice appears where there was none
  it('gives no choice to a block that had none, and shows it as the CV did', () => {
    const out = rebuild(cv);
    expect(out.experience[1].versions).toBeUndefined();
    expect(out.experience[1].description).toEqual(['T Dessiné les écrans']);
  });

  it('keeps an empty adapted summary paired, the translation leaving it out', () => {
    const hidden = withVersions({ ...adapted, personal_info: { ...adapted.personal_info, summary: '' } }, imported);
    const out = rebuild(hidden);
    expect(out.personal_info.versions?.summary).toEqual({ adapted: '', original: `I ${imported.personal_info.summary}` });
    expect(out.personal_info.summary).toBe('');
  });

  it('drops the choices, never the text, when a translation of the versions failed', () => {
    const out = withTranslatedVersions(cv, translated('T')(typedTextsOf(cv)), null, translated('A')(adaptedTextsOf(cv)));
    expect(out.personal_info.versions).toBeUndefined();
    expect(out.experience[0].versions).toBeUndefined();
    expect(out.personal_info.summary).toBe(`T ${adapted.personal_info.summary}`);
  });
});
