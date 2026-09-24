// ─── Block Builder ───
// Converts CVData into measurable ContentBlock descriptors.
// Heights are text-length heuristics for the FIRST paint only —
// usePaginationFit replaces them with real DOM measurements right after.

import type { CVData } from '@/src/shared/types';
import type { ContentBlock, SubBlock } from './types';
import { isHidden, isSkillHidden, getVisibleSkills, getActionBullets, getIntro, shouldShowKPI } from '../display-modes';

// ─── Constants ───

/** Characters per line at the page's content width (single-column templates) */
const CHARS_PER_LINE = 90;
const LINE_HEIGHT = 20;
const SECTION_TITLE_H = 32;
const SPACING = 16;

function estimateTextHeight(text: string, charsPerLine: number): number {
  return Math.max(1, Math.ceil(text.length / charsPerLine)) * LINE_HEIGHT;
}

/**
 * Build ContentBlock descriptors from CVData with estimated heights.
 */
export function buildBlocks(cvData: CVData, includedSections?: string[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  // Sections switched off in the Design tab stay out of the layout, hence out
  // of the preview and the PDF. The toggle used to only lower the ATS score.
  // undefined (older CVs) means everything is shown.
  const shows = (section: string) => !includedSections || includedSections.includes(section);

  // Header
  if (cvData.personal_info) {
    const titleLines = Math.ceil((cvData.personal_info.title?.length || 30) / 40);
    blocks.push({
      id: 'header',
      type: 'header',
      heightPx: Math.ceil(100 + titleLines * 24 + 20),
      splittable: false,
      data: cvData.personal_info,
    });
  }

  // Summary
  if (shows('summary') && cvData.personal_info?.summary) {
    blocks.push({
      id: 'summary',
      type: 'summary',
      heightPx: Math.ceil(SECTION_TITLE_H + estimateTextHeight(cvData.personal_info.summary, CHARS_PER_LINE) + 16),
      splittable: false,
      data: cvData.personal_info.summary,
    });
  }

  // Experiences (one block per visible experience)
  if (shows('experience')) cvData.experience?.filter(exp => !isHidden(exp)).forEach((exp, idx) => {
    const intro = getIntro(exp);
    const bullets = getActionBullets(exp);
    // Same rule as the renderers (showKpi forces it in any mode): the estimate
    // used to reserve the KPI only in extended mode, so a forced KPI was left
    // out of the sub-blocks of a split experience and never painted.
    const showKpi = shouldShowKPI(exp);

    const positionLines = Math.ceil((exp.position?.length || 20) / 35);
    const headerH = positionLines * 22 + 28;
    const introH = intro ? estimateTextHeight(intro, CHARS_PER_LINE) + 8 : 0;

    const subBlocks: SubBlock[] = [
      { id: `exp-${idx}-header`, heightPx: headerH + introH, type: 'exp-header' },
      ...bullets.map((bullet, bIdx) => ({
        id: `exp-${idx}-bullet-${bIdx}`,
        heightPx: estimateTextHeight(bullet, CHARS_PER_LINE) + 6,
        type: 'bullet' as const,
      })),
    ];

    if (showKpi) {
      subBlocks.push({ id: `exp-${idx}-kpi`, heightPx: 28, type: 'kpi' });
    }

    blocks.push({
      id: `exp-${idx}`,
      type: 'experience',
      heightPx: Math.ceil(subBlocks.reduce((s, b) => s + b.heightPx, 0) + SPACING),
      splittable: bullets.length >= 2,
      subBlocks,
      data: exp,
    });
  });

  // Skill categories (one block per visible category).
  // Not splittable: rendered as flex-wrap chips whose real row count depends on
  // text width, so mid-category splits can't be modeled reliably. Categories
  // are small — moving one whole to the next page costs at most one row.
  // A category with no visible item renders nothing: kept, it would still get
  // a "Compétences" title injected above an empty space.
  if (shows('skills')) cvData.skills?.filter(cat => !isSkillHidden(cat) && getVisibleSkills(cat).length > 0).forEach((cat, idx) => {
    const items = getVisibleSkills(cat);
    const titleH = 24;
    const rowH = 28;
    // About five chips per row at the page's width
    const rows = Math.ceil(items.length / 5);

    blocks.push({
      id: `skill-${idx}`,
      type: 'skill-category',
      heightPx: Math.ceil(titleH + rows * rowH + 8),
      splittable: false,
      data: cat,
    });
  });

  // Education
  if (shows('education') && cvData.education?.length) {
    blocks.push({
      id: 'education',
      type: 'education',
      heightPx: Math.ceil(SECTION_TITLE_H + cvData.education.length * 40),
      splittable: false,
      data: cvData.education,
    });
  }

  // Languages
  if (shows('languages') && cvData.languages?.length) {
    blocks.push({
      id: 'languages',
      type: 'languages',
      heightPx: Math.ceil(SECTION_TITLE_H + cvData.languages.length * 26),
      splittable: false,
      data: cvData.languages,
    });
  }

  return blocks;
}
