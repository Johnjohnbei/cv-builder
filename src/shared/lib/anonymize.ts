import type { CVData } from '@/src/shared/types';

export function maskPersonalInfo(cv: CVData): CVData {
  return {
    ...cv,
    personal_info: {
      ...cv.personal_info,
      name: 'Candidat anonyme',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      website: '',
      photo_url: undefined,
    },
  };
}
