// ─── Block Builder ───
// Converts CVData into measurable ContentBlock descriptors.
// Heights are estimated via text-length heuristics, calibrated against real DOM measurements.

import type { CVData } from '@/src/shared/types';
import type { ContentBlock, SubBlock } from './types';
import { isHidden, isSkillHidden, getVisibleSkills, getActionBullets, getIntro } from '../displayModes';

// ─── Constants (calibrated with 20% safety margin over measured values) ───

const CHARS_PER_LINE_NARROW = 60;
const CHARS_PER_LINE_WIDE = 90;
const LINE_HEIGHT = 20;
const SECTION_TITLE_H = 32;
const SPACING = 16;

function estimateTextHeight(text: string, charsPerLine: number): number {
  return Math.max(1, Math.ceil(text.length / charsPerLine)) * LINE_HEIGHT;
}

/**
 * Build ContentBlock descriptors from CVData with estimated heights.
 * Each block maps to a single measurable/renderable unit in the pagination engine.
 */
export function buildBlocks(cvData: CVData): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  // Header
  if (cvData.personal_info) {
    const titleLines = Math.ceil((cvData.personal_info.title?.length || 30) / 40);
    blocks.push({
      id: 'header',
      type: 'header',
      heightPx: 100 + titleLines * 24 + 30,
      fullWidthHeightPx: 100 + titleLines * 24 + 20,
      splittable: false,
      data: cvData.personal_info,
    });
  }

  // Summary
  if (cvData.personal_info?.summary) {
    const textH = estimateTextHeight(cvData.personal_info.summary, CHARS_PER_LINE_NARROW);
    const h = SECTION_TITLE_H + textH + 16;
    blocks.push({
      id: 'summary',
      type: 'summary',
      heightPx: h,
      fullWidthHeightPx: SECTION_TITLE_H + estimateTextHeight(cvData.personal_info.summary, CHARS_PER_LINE_WIDE) + 16,
      splittable: false,
      data: cvData.personal_info.summary,
    });
  }

  // Experiences (one block per visible experience)
  cvData.experience?.filter(exp => !isHidden(exp)).forEach((exp, idx) => {
    const intro = getIntro(exp);
    const bullets = getActionBullets(exp);

    const positionLines = Math.ceil((exp.position?.length || 20) / 35);
    const headerH = positionLines * 22 + 28;
    const introH = intro ? estimateTextHeight(intro, CHARS_PER_LINE_NARROW) + 8 : 0;
    const expHeaderH = headerH + introH;

    const bulletHeights = bullets.map(b => {
      return Math.max(1, Math.ceil(b.length / CHARS_PER_LINE_NARROW)) * LINE_HEIGHT + 6;
    });

    const subBlocks: SubBlock[] = [
      { id: `exp-${idx}-header`, heightPx: expHeaderH, type: 'exp-header' },
      ...bulletHeights.map((bH, bIdx) => ({
        id: `exp-${idx}-bullet-${bIdx}`,
        heightPx: bH,
        type: 'bullet' as const,
      })),
    ];

    if (exp.kpi && exp.displayMode === 'extended') {
      subBlocks.push({ id: `exp-${idx}-kpi`, heightPx: 28, type: 'kpi' });
    }

    const totalH = subBlocks.reduce((s, b) => s + b.heightPx, 0) + SPACING;

    const introHFull = intro ? estimateTextHeight(intro, CHARS_PER_LINE_WIDE) + 8 : 0;
    const bulletHFull = bullets.reduce((s, b) => {
      return s + Math.max(1, Math.ceil(b.length / CHARS_PER_LINE_WIDE)) * LINE_HEIGHT + 6;
    }, 0);
    const totalHFull = headerH + introHFull + bulletHFull + (exp.kpi && exp.displayMode === 'extended' ? 28 : 0) + SPACING;

    blocks.push({
      id: `exp-${idx}`,
      type: 'experience',
      heightPx: totalH,
      fullWidthHeightPx: totalHFull,
      splittable: bullets.length >= 2,
      subBlocks,
      data: exp,
    });
  });

  // Skill categories (one block per visible category)
  cvData.skills?.filter(cat => !isSkillHidden(cat)).forEach((cat, idx) => {
    const items = getVisibleSkills(cat);
    const titleH = 24;
    const rowH = 28;
    // In narrow sidebar, ~2 items per row; in wide column, ~4-5
    const rowsNarrow = Math.ceil(items.length / 2);
    const rowsWide = Math.ceil(items.length / 5);

    const subBlocks = [
      { id: `skill-${idx}-title`, heightPx: titleH, type: 'skill-title' as const },
      ...Array.from({ length: rowsNarrow }, (_, rIdx) => ({
        id: `skill-${idx}-row-${rIdx}`,
        heightPx: rowH,
        type: 'skill-row' as const,
      })),
    ];

    blocks.push({
      id: `skill-${idx}`,
      type: 'skill-category',
      heightPx: titleH + rowsNarrow * rowH + 8,
      fullWidthHeightPx: titleH + rowsWide * rowH + 8,
      splittable: items.length >= 6,
      subBlocks,
      data: cat,
    });
  });

  // Education
  if (cvData.education?.length) {
    blocks.push({
      id: 'education',
      type: 'education',
      heightPx: SECTION_TITLE_H + cvData.education.length * 55,
      fullWidthHeightPx: SECTION_TITLE_H + cvData.education.length * 40,
      splittable: false,
      data: cvData.education,
    });
  }

  // Languages
  if (cvData.languages?.length) {
    blocks.push({
      id: 'languages',
      type: 'languages',
      heightPx: SECTION_TITLE_H + cvData.languages.length * 26,
      fullWidthHeightPx: SECTION_TITLE_H + cvData.languages.length * 26,
      splittable: false,
      data: cvData.languages,
    });
  }

  return blocks;
}
