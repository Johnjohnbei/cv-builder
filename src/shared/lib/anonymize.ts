import type { CVData } from '@/src/shared/types';
import type { PageAssignment } from '@/src/features/editor/lib/pagination/types';

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
      // A nominative portfolio would undo the anonymization, so it only
      // survives if an identity-free variant was provided for it.
      portfolio_url: cv.personal_info.portfolio_anon_url || '',
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
    sidebarBlocks: page.sidebarBlocks?.map(swap) as PageAssignment['sidebarBlocks'],
  }));
}
