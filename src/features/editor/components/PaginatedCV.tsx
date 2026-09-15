import { forwardRef, memo, Fragment } from 'react';
import type { PageAssignment, PlacedBlock, BlockRendererMap } from '../lib/pagination/types';
import type { DesignSettings } from '@/src/shared/types';
import type { SupportedLanguage } from '@/src/lib/languageDetection';
import { CVPage } from './CVPage';
import { getFontClass } from '../templates/shared';
import { getSectionTitle, getContinuationMarker } from '../lib/atsRules';

/**
 * Padding of every page of every template: p-16 (64px). It must equal what
 * templateLayouts.ts allocates, or the last block runs into the margin;
 * PaginatedCV.test.ts checks it.
 */
export const PAGE_PADDING_CLASS = 'p-16';

interface Props {
  pageAssignments: PageAssignment[];
  designSettings: DesignSettings;
  language: SupportedLanguage;
  blockRenderers: BlockRendererMap;
  /** CSS variables for template colors */
  templateStyle?: React.CSSProperties;
  /** Index of the first page that has experience blocks (for "suite" label) */
  firstExperiencePage?: number;
  /**
   * Optional per-page chrome wrapper — lets the caller inject preview visuals
   * (scale, shadow, page labels, spacing) around each CVPage while keeping a
   * single DOM tree for both preview and print. In print mode, the wrapper's
   * visual styles are neutralized via @media print rules.
   */
  renderPageWrapper?: (cvPage: React.ReactNode, pageIndex: number, totalPages: number) => React.ReactNode;
}

/**
 * Section title rendered before the first experience or skill block on a page.
 * Shows "(suite)" on later pages to indicate continuation.
 *
 * NOTE: no mb-4 — the page's gap-4 provides the gap to the following sibling.
 * Keeping mb-4 would create a double gap when title and block are separate
 * live-measurable siblings.
 */
function SectionTitle({ title, color, isContinuation, language }: { title: string; color: string; isContinuation: boolean; language: SupportedLanguage }) {
  return (
    <h2
      className="text-sm font-bold uppercase tracking-wider border-b pb-2"
      style={{ color, borderColor: `${color}20` }}
    >
      {title}{isContinuation ? getContinuationMarker(language) : ''}
    </h2>
  );
}

/**
 * Renders a paginated CV as stacked A4 pages.
 * Each page renders only its assigned blocks using the provided block renderers.
 * Automatically injects section titles before experience and skill blocks.
 */
export const PaginatedCV = memo(forwardRef<HTMLDivElement, Props>(
  function PaginatedCV({
    pageAssignments,
    designSettings,
    language,
    blockRenderers,
    templateStyle,
    firstExperiencePage = 0,
    renderPageWrapper,
  }, ref) {
    const { primaryColor } = designSettings;
    const fontClass = getFontClass(designSettings.fontFamily);
    const totalPages = pageAssignments.length;
    // First page carrying skills: skills on a later page are a continuation
    const firstSkillsPage = pageAssignments.findIndex(p => p.blocks.some(pb => pb.block.type === 'skill-category'));

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
          const firstSkillIdx = page.blocks.findIndex(pb => pb.block.type === 'skill-category');
          const isContinuation = firstExpIdx !== -1 && page.pageIndex > firstExperiencePage;

          const cvPage = (
            <CVPage
              pageIndex={page.pageIndex}
              accentColor={primaryColor}
              fontClass={fontClass}
              style={templateStyle}
              paddingClass={PAGE_PADDING_CLASS}
            >
              {page.blocks.map((pb, i) => (
                <Fragment key={pb.block.id || i}>
                  {/* Inject section title before the first experience on each page */}
                  {i === firstExpIdx && (
                    <div data-live-title="experience">
                      <SectionTitle
                        title={getSectionTitle('experience', language)}
                        color={primaryColor}
                        isContinuation={isContinuation}
                        language={language}
                      />
                    </div>
                  )}
                  {/* Same for skills: the categories printed with no "Compétences"
                      heading, which an ATS needs to find them */}
                  {i === firstSkillIdx && (
                    <div data-live-title="skills">
                      <SectionTitle
                        title={getSectionTitle('skills', language)}
                        color={primaryColor}
                        isContinuation={page.pageIndex > firstSkillsPage}
                        language={language}
                      />
                    </div>
                  )}
                  <div data-live-block={pb.block.id}>
                    {renderBlock(pb, page.pageIndex)}
                  </div>
                </Fragment>
              ))}
            </CVPage>
          );

          // Let the caller wrap each page with custom chrome (scale, label, shadow...).
          // In print mode, @media print rules neutralize the wrapper's visuals.
          const wrapped = renderPageWrapper
            ? renderPageWrapper(cvPage, page.pageIndex, totalPages)
            : cvPage;

          // Use a Fragment with key to preserve React's list identity
          return <Fragment key={page.pageIndex}>{wrapped}</Fragment>;
        })}
      </div>
    );
  },
));
