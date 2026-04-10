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

  // Header block
  if (cvData.personal_info) {
    blocks.push({
      id: 'header',
      type: 'header',
      heightPx: 160, // estimated: name + title + contact + photo
      fullWidthHeightPx: 160,
      splittable: false,
      data: cvData.personal_info,
    });
  }

  // Summary block
  if (cvData.personal_info?.summary) {
    const lines = Math.ceil(cvData.personal_info.summary.length / 80);
    blocks.push({
      id: 'summary',
      type: 'summary',
      heightPx: 60 + lines * 20,
      fullWidthHeightPx: 60 + lines * 20,
      splittable: false,
      data: cvData.personal_info.summary,
    });
  }

  // Experience blocks (one per visible experience)
  cvData.experience?.filter(exp => !isHidden(exp)).forEach((exp, idx) => {
    const intro = getIntro(exp);
    const bullets = getActionBullets(exp);
    const headerHeight = 60; // position + company + intro
    const bulletHeight = 24; // per bullet line estimate

    const subBlocks: SubBlock[] = [
      { id: `exp-${idx}-header`, heightPx: headerHeight + (intro ? 20 : 0), type: 'exp-header' },
      ...bullets.map((_, bIdx) => ({
        id: `exp-${idx}-bullet-${bIdx}`,
        heightPx: bulletHeight,
        type: 'bullet' as const,
      })),
    ];

    if (exp.kpi && exp.displayMode === 'extended') {
      subBlocks.push({ id: `exp-${idx}-kpi`, heightPx: 20, type: 'kpi' as const });
    }

    const totalHeight = subBlocks.reduce((s, b) => s + b.heightPx, 0);

    blocks.push({
      id: `exp-${idx}`,
      type: 'experience',
      heightPx: totalHeight,
      fullWidthHeightPx: totalHeight, // approximate
      splittable: true,
      subBlocks,
      data: exp,
    });
  });

  // Skill category blocks (one per visible category)
  cvData.skills?.filter(cat => !isSkillHidden(cat)).forEach((cat, idx) => {
    const items = getVisibleSkills(cat);
    const titleHeight = 30;
    const rowHeight = 28; // per row of skill tags
    const rows = Math.ceil(items.length / 3); // ~3 tags per row

    const subBlocks = [
      { id: `skill-${idx}-title`, heightPx: titleHeight, type: 'skill-title' as const },
      ...Array.from({ length: rows }, (_, rIdx) => ({
        id: `skill-${idx}-row-${rIdx}`,
        heightPx: rowHeight,
        type: 'skill-row' as const,
      })),
    ];

    blocks.push({
      id: `skill-${idx}`,
      type: 'skill-category',
      heightPx: titleHeight + rows * rowHeight,
      fullWidthHeightPx: titleHeight + rows * rowHeight,
      splittable: items.length >= 4,
      subBlocks,
      data: cat,
    });
  });

  // Education block (all education entries as one block)
  if (cvData.education?.length) {
    blocks.push({
      id: 'education',
      type: 'education',
      heightPx: 60 + cvData.education.length * 40,
      fullWidthHeightPx: 60 + cvData.education.length * 40,
      splittable: false,
      data: cvData.education,
    });
  }

  // Languages block
  if (cvData.languages?.length) {
    blocks.push({
      id: 'languages',
      type: 'languages',
      heightPx: 60 + cvData.languages.length * 24,
      fullWidthHeightPx: 60 + cvData.languages.length * 24,
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
