import { forwardRef } from 'react';
import type { PageAssignment, PlacedBlock, BlockRendererMap } from '../lib/pagination/types';
import type { DesignSettings } from '@/src/shared/types';
import type { SupportedLanguage } from '@/src/lib/languageDetection';
import { CVPage } from './CVPage';
import { getFontClass } from '../templates/shared';
import { getSectionTitle } from '../lib/atsRules';

interface Props {
  pageAssignments: PageAssignment[];
  designSettings: DesignSettings;
  language: SupportedLanguage;
  blockRenderers: BlockRendererMap;
  /** CSS variables for template colors */
  templateStyle?: React.CSSProperties;
  /** Padding class override per template */
  paddingClass?: string;
  /** Index of the first page that has experience blocks (for "suite" label) */
  firstExperiencePage?: number;
}

/**
 * Section title rendered before the first experience block on a page.
 * Shows "(suite)" on pages 2+ to indicate continuation.
 */
function SectionTitle({ title, color, isContinuation }: { title: string; color: string; isContinuation: boolean }) {
  return (
    <h2
      className="text-sm font-bold uppercase tracking-wider border-b pb-2 mb-4"
      style={{ color, borderColor: `${color}20` }}
    >
      {title}{isContinuation ? ' (suite)' : ''}
    </h2>
  );
}

/**
 * Renders a paginated CV as stacked A4 pages.
 * Each page renders only its assigned blocks using the provided block renderers.
 * Automatically injects section titles before experience blocks.
 */
export const PaginatedCV = forwardRef<HTMLDivElement, Props>(
  function PaginatedCV({
    pageAssignments,
    designSettings,
    language,
    blockRenderers,
    templateStyle,
    paddingClass,
    firstExperiencePage = 0,
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
        {pageAssignments.map((page) => {
          const firstExpIdx = page.blocks.findIndex(pb => pb.block.type === 'experience');
          const hasExperiences = firstExpIdx !== -1;
          const isContinuation = hasExperiences && page.pageIndex > firstExperiencePage;

          return (
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
                  ? (() => {
                      let skillsTitleShown = false;
                      return page.sidebarBlocks.map((sb, i) => {
                        const needsSkillsTitle = sb.block.type === 'skill-category' && !skillsTitleShown;
                        if (needsSkillsTitle) skillsTitleShown = true;
                        return (
                          <div key={sb.block.id || i}>
                            {needsSkillsTitle && (
                              <SectionTitle
                                title={getSectionTitle('skills', language)}
                                color={designSettings.atsMode ? '#000' : primaryColor}
                                isContinuation={false}
                              />
                            )}
                            {renderBlock(sb, page.pageIndex)}
                          </div>
                        );
                      });
                    })()
                  : undefined
              }
            >
              {page.blocks.map((pb, i) => (
                <div key={pb.block.id || i}>
                  {/* Inject section title before the first experience on each page */}
                  {i === firstExpIdx && (
                    <SectionTitle
                      title={getSectionTitle('experience', language)}
                      color={designSettings.atsMode ? '#000' : primaryColor}
                      isContinuation={isContinuation}
                    />
                  )}
                  {renderBlock(pb, page.pageIndex)}
                </div>
              ))}
            </CVPage>
          );
        })}
      </div>
    );
  },
);
