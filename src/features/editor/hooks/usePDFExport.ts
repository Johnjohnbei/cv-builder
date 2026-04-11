import { useCallback, useState, type RefObject } from 'react';
import { serverlessPDF, renderPDF } from '@/src/features/editor/lib/pdfExport';
import { extractExpectedText } from '@/src/features/editor/lib/pdfValidation';
import type { CVData, DesignSettings } from '@/src/shared/types';

export interface UsePDFExportDeps {
  cvRef: RefObject<HTMLElement | null>;
  cvData: CVData | null;
  designSettings: DesignSettings;
  notify: (args: { message: string; type: 'success' | 'error' }) => void;
}

export interface UsePDFExportResult {
  isExporting: boolean;
  downloadPDF: () => Promise<void>;
  previewPDF: () => void;
}

/**
 * PDF export + print preview.
 *
 * `downloadPDF` uses serverlessPDF (with text-validation fallback), which
 * toggles isExporting via onLoadingChange.
 *
 * `previewPDF` opens the browser print dialog via renderPDF — no modal, no
 * state. The legacy preview-URL modal was dead code (previewUrl never set)
 * and has been removed.
 */
export function usePDFExport(deps: UsePDFExportDeps): UsePDFExportResult {
  const { cvRef, cvData, designSettings, notify } = deps;
  const [isExporting, setIsExporting] = useState(false);

  const downloadPDF = useCallback(async () => {
    if (!cvRef.current || isExporting) return;
    const expectedText = cvData ? extractExpectedText(cvData) : '';
    await serverlessPDF(cvRef.current, designSettings, {
      expectedText,
      onValidation: (result) => {
        if (!result.valid && result.warning) {
          notify({ message: result.warning, type: 'error' });
        }
      },
      onLoadingChange: setIsExporting,
      onFallback: (reason) => {
        notify({ message: reason, type: 'error' });
      },
    });
  }, [cvRef, cvData, designSettings, notify, isExporting]);

  const previewPDF = useCallback(() => {
    if (!cvRef.current) return;
    const expectedText = cvData ? extractExpectedText(cvData) : '';
    renderPDF(cvRef.current, designSettings, {
      expectedText,
      onValidation: (result) => {
        if (!result.valid && result.warning) {
          notify({ message: result.warning, type: 'error' });
        }
      },
    });
  }, [cvRef, cvData, designSettings, notify]);

  return { isExporting, downloadPDF, previewPDF };
}
