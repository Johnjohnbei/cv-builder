// ─── Off-screen Measurement Container ───
// Renders each block at two widths for DOM height measurement.

import type { ContentBlock, BlockRendererMap, PlacedBlock } from '../lib/pagination/types';
import type { DesignSettings } from '@/src/shared/types';
import type { SupportedLanguage } from '@/src/lib/languageDetection';
import { getFontClass } from '../templates/shared';

/** Block types placed in the sidebar column */
const SIDEBAR_TYPES = new Set(['skill-category', 'education', 'languages']);

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
 * Hidden container rendering blocks at main-column and full widths.
 * usePaginationFit reads offsetHeight via data-measure-block attributes.
 */
export function MeasurementContainer({
  blocks, blockRenderers, designSettings, language, mainWidthMm, fullWidthMm, sidebarWidthMm, templateStyle,
}: Props) {
  const fontClass = getFontClass(designSettings.fontFamily);

  const renderBlock = (block: ContentBlock) => {
    const renderer = blockRenderers[block.type];
    if (!renderer) return null;
    const placed: PlacedBlock = { block };
    return renderer({ block: placed, designSettings, language, isPage2Plus: false });
  };

  return (
    <div
      aria-hidden="true"
      data-measure-container="true"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 0,
        visibility: 'hidden',
        pointerEvents: 'none',
        ...templateStyle,
      }}
    >
      <div style={{ width: `${mainWidthMm}mm` }} className={fontClass}>
        {blocks.map(block => (
          <div key={`m-${block.id}`} data-measure-block={block.id} data-measure-width="main">
            {renderBlock(block)}
          </div>
        ))}
      </div>
      <div style={{ width: `${fullWidthMm}mm` }} className={fontClass}>
        {blocks.map(block => (
          <div key={`f-${block.id}`} data-measure-block={block.id} data-measure-width="full">
            {renderBlock(block)}
          </div>
        ))}
      </div>
      {sidebarWidthMm > 0 && (
        <div style={{ width: `${sidebarWidthMm}mm` }} className={fontClass}>
          {blocks.filter(b => SIDEBAR_TYPES.has(b.type)).map(block => (
            <div key={`s-${block.id}`} data-measure-block={block.id} data-measure-width="sidebar">
              {renderBlock(block)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
