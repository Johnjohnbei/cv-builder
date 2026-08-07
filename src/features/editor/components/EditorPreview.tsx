import { forwardRef, memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
import type { DesignSettings } from '@/src/shared/types';
import type { PageAssignment, BlockRendererMap } from '../lib/pagination/types';
import { PaginatedCV } from './PaginatedCV';

interface Props {
  pageAssignments: PageAssignment[];
  hasCvData: boolean;
  designSettings: DesignSettings;
  language: 'fr' | 'en';
  blockRenderers: BlockRendererMap;
  selectedTemplate: string;
  templateStyle: React.CSSProperties;
  firstExperiencePage: number;
  zoom: number;
  /** Ref on the [data-cv-root] node: read by the PDF export and the pagination reconcile */
  cvRootRef: React.Ref<HTMLDivElement>;
}

/**
 * The A4 preview surface.
 *
 * Single-tree architecture: this same DOM is what gets printed and what the
 * export serializes, so the preview chrome (scale, shadow, page labels) is
 * injected around each page rather than baked into it, and neutralized by the
 * @media print rules in index.css.
 *
 * The scroll container ref stays owned by the page (useAutoZoom measures it).
 */
export const EditorPreview = memo(forwardRef<HTMLDivElement, Props>(
  function EditorPreview({
    pageAssignments, hasCvData, designSettings, language, blockRenderers,
    selectedTemplate, templateStyle, firstExperiencePage, zoom, cvRootRef,
  }, scrollRef) {
    const renderPageWrapper = useCallback((cvPage: React.ReactNode, pageIndex: number, totalPages: number) => (
      <div
        className="cv-page-slot"
        style={{ marginBottom: pageIndex < totalPages - 1 ? '24px' : 0 }}
      >
        {/* Page label for pages 2+ — hidden in print */}
        {pageIndex > 0 && (
          <div className="cv-page-label flex items-center justify-center mb-2">
            <span className="text-[11px] font-mono text-gray-600 uppercase tracking-wider">Page {pageIndex + 1}</span>
          </div>
        )}
        {/* Scaled frame: fixed outer box + transform-scaled inner at true 210×297mm */}
        <div
          className="cv-page-frame relative shrink-0 overflow-hidden"
          style={{
            width: `${210 * (zoom / 100)}mm`,
            height: `${297 * (zoom / 100)}mm`,
          }}
        >
          <div
            className="cv-page-scale bg-white shadow-2xl border border-[#DADCE0]"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top left',
              width: '210mm',
              height: '297mm',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          >
            {cvPage}
          </div>
        </div>
      </div>
    ), [zoom]);

    return (
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-4 sm:p-8 lg:p-12 flex flex-col items-center min-h-0 relative scroll-smooth bg-[#F1F3F4]"
      >
        {hasCvData && pageAssignments.length > 0 ? (
          <div ref={cvRootRef} data-cv-root className="flex flex-col items-center" style={{ marginBottom: '100px' }}>
            <PaginatedCV
              pageAssignments={pageAssignments}
              designSettings={designSettings}
              language={language}
              blockRenderers={blockRenderers}
              selectedTemplate={selectedTemplate}
              templateStyle={templateStyle}
              firstExperiencePage={firstExperiencePage}
              renderPageWrapper={renderPageWrapper}
            />
          </div>
        ) : (
          <div
            style={{
              width: `${210 * (zoom / 100)}mm`,
              height: `${297 * (zoom / 100)}mm`,
            }}
            className="relative shrink-0 shadow-2xl border border-[#DADCE0] bg-white flex items-center justify-center"
          >
            <div className="text-center max-w-sm p-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-sm font-bold text-gray-700 mb-2">Aucun CV chargé</h3>
              <p className="text-xs text-gray-500 mb-6">Importez un CV depuis le tableau de bord ou créez-en un nouveau pour commencer l'édition.</p>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour au tableau de bord
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  },
));
