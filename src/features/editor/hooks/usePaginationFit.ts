import { useState, useEffect, useRef, useMemo } from 'react';
import type { CVData, DesignSettings } from '@/src/shared/types';
import type { ContentBlock, PageAssignment, SubBlock } from '../lib/pagination/types';
import { MEASUREMENT_SAFETY_PX } from '../lib/pagination/types';
import { getTemplateLayout } from '../lib/pagination/templateLayouts';
import { allocatePages } from '../lib/pagination/allocatePages';
import { isHidden, isSkillHidden, getVisibleSkills, getActionBullets, getIntro } from '../lib/displayModes';
import { extractKeywords, scoreExperience } from '../lib/scoring';
import { condenseOneStep } from '../lib/autoFit';

const MAX_FIT_ITERATIONS = 50;

/**
 * Build ContentBlock descriptors from CVData.
 * Heights are estimated (will be refined by measurement pass when wired up).
 * For now we use heuristic height estimation based on content length.
 */
function buildBlocks(cvData: CVData): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  // ─── Height estimation helpers ───
  // Calibrated against real DOM measurements (TemplateA at ~428px main column width).
  // Intro/description text wraps at ~55 chars/line in the narrow main column (~45 for full-width).
  const CHARS_PER_LINE_NARROW = 55;
  const CHARS_PER_LINE_WIDE = 85;
  const LINE_HEIGHT = 22; // text-sm leading-relaxed ≈ 22px
  const SECTION_TITLE_H = 40; // h2 + border-b + pb-2 + mb-4
  const SPACING = 24; // space-y-6 gap between blocks

  function estimateTextHeight(text: string, charsPerLine: number): number {
    const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
    return lines * LINE_HEIGHT;
  }

  // Header block (~186px measured)
  if (cvData.personal_info) {
    const titleLines = Math.ceil((cvData.personal_info.title?.length || 30) / 40);
    blocks.push({
      id: 'header',
      type: 'header',
      heightPx: 120 + titleLines * 28 + 40, // name(48) + title(28*lines) + contact(24) + spacing(48)
      fullWidthHeightPx: 120 + titleLines * 28 + 20,
      splittable: false,
      data: cvData.personal_info,
    });
  }

  // Summary block (~181px measured for ~350 chars)
  if (cvData.personal_info?.summary) {
    const textH = estimateTextHeight(cvData.personal_info.summary, CHARS_PER_LINE_NARROW);
    const h = SECTION_TITLE_H + textH + 16; // title + text + margins
    blocks.push({
      id: 'summary',
      type: 'summary',
      heightPx: h,
      fullWidthHeightPx: SECTION_TITLE_H + estimateTextHeight(cvData.personal_info.summary, CHARS_PER_LINE_WIDE) + 16,
      splittable: false,
      data: cvData.personal_info.summary,
    });
  }

  // Experience blocks — calibrated against real measurements
  cvData.experience?.filter(exp => !isHidden(exp)).forEach((exp, idx) => {
    const intro = getIntro(exp);
    const bullets = getActionBullets(exp);

    // Exp header: position + date row(28) + company(24) + margin(8)
    const positionLines = Math.ceil((exp.position?.length || 20) / 35);
    const headerH = positionLines * 24 + 32; // position + date + company + spacing
    const introH = intro ? estimateTextHeight(intro, CHARS_PER_LINE_NARROW) + 8 : 0;
    const expHeaderH = headerH + introH;

    // Each bullet: text wraps, average ~2 lines
    const bulletHeights = bullets.map(b => {
      const lines = Math.max(1, Math.ceil(b.length / CHARS_PER_LINE_NARROW));
      return lines * LINE_HEIGHT + 6; // + space-y-1.5
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
      subBlocks.push({ id: `exp-${idx}-kpi`, heightPx: 28, type: 'kpi' as const });
    }

    const totalH = subBlocks.reduce((s, b) => s + b.heightPx, 0) + SPACING;

    // Full-width version: narrower text wraps less
    const introHFull = intro ? estimateTextHeight(intro, CHARS_PER_LINE_WIDE) + 8 : 0;
    const bulletHFull = bullets.reduce((s, b) => {
      const lines = Math.max(1, Math.ceil(b.length / CHARS_PER_LINE_WIDE));
      return s + lines * LINE_HEIGHT + 6;
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

  // Skill category blocks
  cvData.skills?.filter(cat => !isSkillHidden(cat)).forEach((cat, idx) => {
    const items = getVisibleSkills(cat);
    const titleH = 32; // category title + spacing
    const rowH = 34; // flex-wrap row of tags (px-2 py-1 + gap-2)
    // ~3 tags per row in sidebar, ~5 in full-width
    const rowsNarrow = Math.ceil(items.length / 3);
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
      heightPx: titleH + rowsNarrow * rowH + 16,
      fullWidthHeightPx: titleH + rowsWide * rowH + 16,
      splittable: items.length >= 6,
      subBlocks,
      data: cat,
    });
  });

  // Education block
  if (cvData.education?.length) {
    blocks.push({
      id: 'education',
      type: 'education',
      heightPx: SECTION_TITLE_H + cvData.education.length * 55,
      fullWidthHeightPx: SECTION_TITLE_H + cvData.education.length * 50,
      splittable: false,
      data: cvData.education,
    });
  }

  // Languages block
  if (cvData.languages?.length) {
    blocks.push({
      id: 'languages',
      type: 'languages',
      heightPx: SECTION_TITLE_H + cvData.languages.length * 28,
      fullWidthHeightPx: SECTION_TITLE_H + cvData.languages.length * 28,
      splittable: false,
      data: cvData.languages,
    });
  }

  return blocks;
}

/**
 * Orchestrates the full pagination pipeline:
 * 1. Build content blocks from CVData
 * 2. Allocate blocks to pages
 * 3. Auto-condense if overflow exceeds pageLimit
 *
 * Replaces useOverflowDetection with a proper pagination-aware system.
 */
export function usePaginationFit(
  cvData: CVData | null,
  designSettings: DesignSettings,
  selectedTemplate: string,
  jobDescription: string,
  userModified: boolean,
  isExporting: boolean,
  setCvData: React.Dispatch<React.SetStateAction<CVData | null>>,
): {
  pageAssignments: PageAssignment[];
  actualPageCount: number;
} {
  const fitIterations = useRef(0);
  const layout = useMemo(() => getTemplateLayout(selectedTemplate), [selectedTemplate]);
  const pageLimit = designSettings.pageLimit || 2;

  const pageAssignments = useMemo(() => {
    if (!cvData) return [];
    const blocks = buildBlocks(cvData);
    return allocatePages(blocks, layout, pageLimit);
  }, [cvData, layout, pageLimit]);

  const actualPageCount = pageAssignments.length;

  // Auto-fit: condense if we exceed pageLimit
  useEffect(() => {
    if (!cvData || userModified || isExporting) return;
    if (actualPageCount <= pageLimit) return;
    if (fitIterations.current >= MAX_FIT_ITERATIONS) return;

    const keywords = extractKeywords(jobDescription);
    const priorities = cvData.experience.map(exp => scoreExperience(exp, keywords));
    const result = condenseOneStep(cvData.experience, cvData.skills, priorities);

    if (result) {
      fitIterations.current++;
      setCvData(prev => prev ? { ...prev, experience: result.experiences, skills: result.skills } : null);
    }
  }, [cvData, actualPageCount, pageLimit, userModified, isExporting, jobDescription, setCvData]);

  return { pageAssignments, actualPageCount };
}
