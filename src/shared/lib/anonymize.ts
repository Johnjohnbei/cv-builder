import type { CVData } from '@/src/shared/types';
import type { PageAssignment } from '@/src/features/editor/lib/pagination/types';
import { getCVLanguage } from '@/src/lib/languageDetection';

const ANONYMOUS_NAME = { fr: 'Candidat anonyme', en: 'Anonymous candidate' } as const;

export function maskPersonalInfo(cv: CVData): CVData {
  const anonUrl = cv.personal_info.portfolio_anon_url || '';
  return {
    ...cv,
    personal_info: {
      ...cv.personal_info,
      name: ANONYMOUS_NAME[getCVLanguage(cv)],
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      website: '',
      photo_url: undefined,
      // A nominative portfolio would undo the anonymization, so it only
      // survives if an identity-free variant was provided for it.
      portfolio_url: anonUrl,
      // The label is free text and can carry the candidate's name ("Portfolio
      // Marie Dupont"), so a masked CV prints a neutral one.
      portfolio_label: anonUrl ? 'Portfolio' : '',
    },
  };
}

/**
 * Swap the masked identity into already-paginated header blocks.
 *
 * Anonymization deliberately happens AFTER layout, never before: feeding the
 * pagination engine a shorter name would shift every measured height and make
 * the page count jump the moment the toggle is flipped. The layout stays
 * computed on the real data; only what is painted changes.
 */
export function maskHeaderBlocks(pages: PageAssignment[], cv: CVData): PageAssignment[] {
  const masked = maskPersonalInfo(cv).personal_info;
  const swap = (pb: { block: { type: string } }) =>
    pb.block.type === 'header'
      ? { ...pb, block: { ...pb.block, data: masked } }
      : pb;

  return pages.map(page => ({
    ...page,
    blocks: page.blocks.map(swap) as PageAssignment['blocks'],
  }));
}
