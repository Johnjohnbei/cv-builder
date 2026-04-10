// ─── Off-screen Measurement Container ───
// Renders blocks invisibly at three widths to measure their real DOM heights.

import { forwardRef } from 'react';
import type { ContentBlock, BlockRendererMap, PlacedBlock } from '../lib/pagination/types';
import type { DesignSettings } from '@/src/shared/types';
import type { SupportedLanguage } from '@/src/lib/languageDetection';
import { getFontClass } from '../templates/shared';

/** Block types that go into the sidebar column */
const SIDEBAR_BLOCK_TYPES = new Set(['skill-category', 'education', 'languages']);

interface Props {
  blocks: ContentBlock[];
  blockRenderers: BlockRendererMap;
  designSettings: DesignSettings;
  language: SupportedLanguage;
  mainWidthMm: number;
  fullWidthMm: number;
  sidebarWidthMm: number;
  templateStyle?: React.CSSProperties;
}

/**
 * Hidden container that renders each block at three widths:
 * - main column (page 1 experiences)
 * - full width (pages 2+)
 * - sidebar width (page 1 sidebar blocks: skills, education, languages)
 */
export const MeasurementContainer = forwardRef<HTMLDivElement, Props>(
  function MeasurementContainer({
    blocks,
    blockRenderers,
    designSettings,
    language,
    mainWidthMm,
    fullWidthMm,
    sidebarWidthMm,
    templateStyle,
  }, ref) {
    const fontClass = getFontClass(designSettings.fontFamily);

    const renderBlock = (block: ContentBlock) => {
      const renderer = blockRenderers[block.type];
      if (!renderer) return null;
      const placed: PlacedBlock = { block };
      return renderer({ block: placed, designSettings, language, isPage2Plus: false });
    };

    const sidebarBlocks = blocks.filter(b => SIDEBAR_BLOCK_TYPES.has(b.type));

    return (
      <div
        ref={ref}
        aria-hidden="true"
        data-measure-container="true"
        className="print:hidden"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          visibility: 'hidden',
          pointerEvents: 'none',
          ...templateStyle,
        }}
      >
        {/* Main column width */}
        <div style={{ width: `${mainWidthMm}mm` }} className={fontClass}>
          {blocks.map(block => (
            <div key={`main-${block.id}`} data-measure-block={block.id} data-measure-width="main">
              {renderBlock(block)}
            </div>
          ))}
        </div>

        {/* Full width */}
        <div style={{ width: `${fullWidthMm}mm` }} className={fontClass}>
          {blocks.map(block => (
            <div key={`full-${block.id}`} data-measure-block={block.id} data-measure-width="full">
              {renderBlock(block)}
            </div>
          ))}
        </div>

        {/* Sidebar width (only sidebar-type blocks) */}
        {sidebarWidthMm > 0 && (
          <div style={{ width: `${sidebarWidthMm}mm` }} className={fontClass}>
            {sidebarBlocks.map(block => (
              <div key={`sidebar-${block.id}`} data-measure-block={block.id} data-measure-width="sidebar">
                {renderBlock(block)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);
