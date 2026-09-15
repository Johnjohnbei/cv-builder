import { describe, it, expect } from 'vitest';
import { getTemplateGridConfig } from './PaginatedCV';
import { TEMPLATE_LAYOUTS } from '../lib/pagination/templateLayouts';

/** Top and bottom padding set by Tailwind classes (p-N, py-N, pt-N, pb-N; 1 unit = 4px; later classes win) */
function verticalPaddingPx(classes: string): { top: number; bottom: number } {
  let top = 0;
  let bottom = 0;
  for (const [, side, units] of classes.matchAll(/(?:^|\s)p([tyb]?)-(\d+)(?=\s|$)/g)) {
    const px = Number(units) * 4;
    if (side !== 'b') top = px;
    if (side !== 't') bottom = px;
  }
  return { top, bottom };
}

const toPx = (mm: number) => Math.round((mm * 96) / 25.4);

describe('rendered vertical padding equals the padding the layout allocates', () => {
  it.each(Object.keys(TEMPLATE_LAYOUTS))('%s', (templateId) => {
    const grid = getTemplateGridConfig(templateId);
    const { page1, page2Plus } = TEMPLATE_LAYOUTS[templateId];

    // Page 1: page-level padding, or each column's own when the page has none (Modern)
    const page1Columns = grid.paddingClass
      ? [grid.paddingClass]
      : [grid.mainClassName ?? '', grid.sidebarClassName ?? ''];
    for (const classes of page1Columns) {
      expect(verticalPaddingPx(classes)).toEqual({ top: toPx(page1.paddingTopMm), bottom: toPx(page1.paddingBottomMm) });
    }

    expect(verticalPaddingPx(grid.page2PaddingClass))
      .toEqual({ top: toPx(page2Plus.paddingTopMm), bottom: toPx(page2Plus.paddingBottomMm) });
  });

  it('reads top and bottom classes separately', () => {
    expect(verticalPaddingPx('p-16 pb-10')).toEqual({ top: 64, bottom: 40 });
    expect(verticalPaddingPx('px-16 py-12')).toEqual({ top: 48, bottom: 48 });
  });
});
