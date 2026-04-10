// ─── Off-screen Measurement Container ───
// Renders blocks invisibly at two widths to measure their real DOM heights.

import { forwardRef } from 'react';
import type { ContentBlock, BlockRendererMap, PlacedBlock } from '../lib/pagination/types';
import type { DesignSettings } from '@/src/shared/types';
import type { SupportedLanguage } from '@/src/lib/languageDetection';
import { getFontClass } from '../templates/shared';

interface Props {
  blocks: ContentBlock[];
  blockRenderers: BlockRendererMap;
  designSettings: DesignSettings;
  language: SupportedLanguage;
  mainWidthMm: number;
  fullWidthMm: number;
  templateStyle?: React.CSSProperties;
}

/**
 * Hidden container that renders each block at two widths (main column + full width).
 * Used by useMeasureBlocks to read real offsetHeight values.
 */
export const MeasurementContainer = forwardRef<HTMLDivElement, Props>(
  function MeasurementContainer({
    blocks,
    blockRenderers,
    designSettings,
    language,
    mainWidthMm,
    fullWidthMm,
    templateStyle,
  }, ref) {
    const fontClass = getFontClass(designSettings.fontFamily);

    const renderBlock = (block: ContentBlock) => {
      const renderer = blockRenderers[block.type];
      if (!renderer) return null;
      const placed: PlacedBlock = { block };
      return renderer({ block: placed, designSettings, language, isPage2Plus: false });
    };

    return (
      <div
        ref={ref}
        aria-hidden="true"
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
      </div>
    );
  },
);
