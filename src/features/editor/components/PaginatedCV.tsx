import { forwardRef } from 'react';
import type { PageAssignment, PlacedBlock, BlockRendererMap } from '../lib/pagination/types';
import type { DesignSettings } from '@/src/shared/types';
import type { SupportedLanguage } from '@/src/lib/languageDetection';
import { CVPage } from './CVPage';
import { getFontClass } from '../templates/shared';

interface Props {
  pageAssignments: PageAssignment[];
  designSettings: DesignSettings;
  language: SupportedLanguage;
  blockRenderers: BlockRendererMap;
  /** CSS variables for template colors */
  templateStyle?: React.CSSProperties;
  /** Padding class override per template */
  paddingClass?: string;
  /** Grid class override for page 1 sidebar layout */
  page1GridClass?: string;
}

/**
 * Renders a paginated CV as stacked A4 pages.
 * Each page renders only its assigned blocks using the provided block renderers.
 * The ref exposes the container for export serialization.
 */
export const PaginatedCV = forwardRef<HTMLDivElement, Props>(
  function PaginatedCV({
    pageAssignments,
    designSettings,
    language,
    blockRenderers,
    templateStyle,
    paddingClass,
    page1GridClass,
  }, ref) {
    const { primaryColor } = designSettings;
    const fontClass = getFontClass(designSettings.fontFamily);
    const isTwoColumn = pageAssignments[0]?.layoutMode === 'two-column';

    const renderBlock = (placed: PlacedBlock, pageIndex: number) => {
      const renderer = blockRenderers[placed.block.type];
      if (!renderer) return null;
      return renderer({
        block: placed,
        designSettings,
        language,
        isPage2Plus: pageIndex > 0,
      });
    };

    return (
      <div ref={ref} className="pdf-safe">
        {pageAssignments.map((page) => (
          <CVPage
            key={page.pageIndex}
            pageIndex={page.pageIndex}
            twoColumn={isTwoColumn && page.pageIndex === 0}
            accentColor={primaryColor}
            fontClass={fontClass}
            style={templateStyle}
            paddingClass={paddingClass}
            sidebar={
              page.sidebarBlocks && page.sidebarBlocks.length > 0
                ? page.sidebarBlocks.map((sb, i) => (
                    <div key={sb.block.id || i}>
                      {renderBlock(sb, page.pageIndex)}
                    </div>
                  ))
                : undefined
            }
          >
            {page.blocks.map((pb, i) => (
              <div key={pb.block.id || i}>
                {renderBlock(pb, page.pageIndex)}
              </div>
            ))}
          </CVPage>
        ))}
      </div>
    );
  },
);
