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

  it('forwards the access code', async () => {
    const translate = vi.fn().mockResolvedValue(EN_SNAPSHOT as unknown as CVData);
    await attachBilingualCache(FR_CV, translate, 'CODE123');
    expect(translate).toHaveBeenCalledWith(expect.objectContaining({ accessCode: 'CODE123' }));
  });
});
