import { describe, it, expect, vi } from 'vitest';
import { attachBilingualCache } from './bilingual';
import type { CVData } from '../shared/types';

const FR_CV: CVData = {
  personal_info: { name: 'Jean', email: 'j@x.fr', title: 'Chef de produit', summary: 'Résumé en français' },
  experience: [{ company: 'Acme', position: 'Chef de produit', start_date: '2020', end_date: '', current: true, description: ['Pilote le produit'], kpi: 'Équipe de 5', displayMode: 'normal' }],
  education: [],
  skills: [],
  languages: [{ name: 'Français', proficiency: 'native' }],
  detectedLanguage: 'fr',
  languageOverride: 'fr',
};

const EN_SNAPSHOT = {
  personal_info: { name: 'Jean', email: 'j@x.fr', title: 'Product Manager', summary: 'Summary in English' },
  experience: FR_CV.experience,
  education: [],
  skills: [],
  languages: [{ name: 'French', proficiency: 'native' }],
};

describe('attachBilingualCache', () => {
  it('translates to the other language and caches BOTH snapshots', async () => {
    const translate = vi.fn().mockResolvedValue(EN_SNAPSHOT as unknown as CVData);
    const result = await attachBilingualCache(FR_CV, translate);

    // Called for the OTHER language (fr → en)
    expect(translate).toHaveBeenCalledWith({ cvData: FR_CV, targetLanguage: 'en', accessCode: undefined });
    // Both languages cached → toggle is instant from the first click
    expect(result._translations?.fr).toBeDefined();
    expect(result._translations?.en).toBeDefined();
    expect(result._translations?.fr?.personal_info.title).toBe('Chef de produit');
    expect(result._translations?.en?.personal_info.title).toBe('Product Manager');
  });

  it('translates EN → FR when the source CV is English', async () => {
    const enCv: CVData = { ...FR_CV, detectedLanguage: 'en', languageOverride: 'en' };
    const translate = vi.fn().mockResolvedValue(EN_SNAPSHOT as unknown as CVData);
    await attachBilingualCache(enCv, translate);
    expect(translate).toHaveBeenCalledWith({ cvData: enCv, targetLanguage: 'fr', accessCode: undefined });
  });

  it('degrades gracefully: returns the CV unchanged if translation fails', async () => {
    const translate = vi.fn().mockRejectedValue(new Error('provider down'));
    const result = await attachBilingualCache(FR_CV, translate);
    // No cache attached, original CV preserved → lazy toggle still works later
    expect(result._translations?.en).toBeUndefined();
    expect(result.personal_info.title).toBe('Chef de produit');
  });

  it('keeps user-owned fields out of both snapshots (the photo is not stored three times)', async () => {
    const photo = 'data:image/png;base64,AAAA';
    const withPhoto: CVData = { ...FR_CV, personal_info: { ...FR_CV.personal_info, photo_url: photo, portfolio_url: 'https://p.example' } };
    const translated = { ...EN_SNAPSHOT, personal_info: { ...EN_SNAPSHOT.personal_info, photo_url: photo } };
    const result = await attachBilingualCache(withPhoto, vi.fn().mockResolvedValue(translated as unknown as CVData));

    expect(result.personal_info.photo_url).toBe(photo);
    expect(result._translations?.fr?.personal_info).not.toHaveProperty('photo_url');
    expect(result._translations?.fr?.personal_info).not.toHaveProperty('portfolio_url');
    expect(result._translations?.en?.personal_info).not.toHaveProperty('photo_url');
  });

  it('forwards the access code', async () => {
    const translate = vi.fn().mockResolvedValue(EN_SNAPSHOT as unknown as CVData);
    await attachBilingualCache(FR_CV, translate, 'CODE123');
    expect(translate).toHaveBeenCalledWith(expect.objectContaining({ accessCode: 'CODE123' }));
  });
});

// The generation leaves the imported texts beside the adapted ones, in both
// languages: the editor picks between them and never calls the AI
describe('attachBilingualCache with the imported CV', () => {
  const IMPORTED_FR: CVData = {
    ...FR_CV,
    detectedLanguage: undefined, languageOverride: undefined,
    personal_info: { ...FR_CV.personal_info, summary: 'Mon résumé à moi, écrit en français pour mes candidatures.' },
    experience: [{ ...FR_CV.experience[0], description: ['Piloté la feuille de route du produit'] }],
  };
  const TAILORED_EN: CVData = {
    ...FR_CV, detectedLanguage: 'en', languageOverride: 'en',
    personal_info: { ...FR_CV.personal_info, summary: 'Product manager for B2B SaaS.' },
    experience: [{ ...FR_CV.experience[0], description: ['Led the product roadmap with Figma'] }],
  };
  const IMPORTED_EN = { ...IMPORTED_FR, personal_info: { ...IMPORTED_FR.personal_info, summary: 'My own summary, written in French for my applications.' } };
  const TAILORED_FR = { ...TAILORED_EN, personal_info: { ...TAILORED_EN.personal_info, summary: 'Chef de produit pour le SaaS B2B.' } };

  it('pairs each language with the imported CV in that language, translating it once', async () => {
    const translate = vi.fn(async ({ cvData }: { cvData: CVData }) => (cvData === TAILORED_EN ? TAILORED_FR : IMPORTED_EN) as CVData);
    const result = await attachBilingualCache(TAILORED_EN, translate, 'CODE', IMPORTED_FR);
    expect(translate).toHaveBeenCalledTimes(2);
    expect(translate).toHaveBeenCalledWith({ cvData: IMPORTED_FR, targetLanguage: 'en', accessCode: 'CODE' });
    expect(result.personal_info.versions?.summary?.original).toBe(IMPORTED_EN.personal_info.summary);
    expect(result._translations?.fr?.personal_info.versions?.summary).toEqual({
      adapted: 'Chef de produit pour le SaaS B2B.', original: IMPORTED_FR.personal_info.summary,
    });
  });

  it('keeps the versions it has when translating the imported CV fails', async () => {
    const translate = vi.fn(async ({ cvData }: { cvData: CVData }) => {
      if (cvData === IMPORTED_FR) throw new Error('provider down');
      return TAILORED_FR as CVData;
    });
    const result = await attachBilingualCache(TAILORED_EN, translate, undefined, IMPORTED_FR);
    // No imported version in English, the generated language: no choice offered there
    expect(result.personal_info.versions).toBeUndefined();
    expect(result._translations?.fr?.personal_info.versions?.summary?.original).toBe(IMPORTED_FR.personal_info.summary);
  });
});
