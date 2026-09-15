import { useCallback, useMemo, useState, type RefObject } from 'react';
import { serverlessPDF, renderPDF, buildPdfFileName } from '@/src/features/editor/lib/pdfExport';
import { extractExpectedText } from '@/src/features/editor/lib/pdfValidation';
import { maskPersonalInfo } from '@/src/shared/lib/anonymize';
import type { CVData, DesignSettings } from '@/src/shared/types';

export interface UseExportDeps {
  cvRef: RefObject<HTMLElement | null>;
  cvData: CVData | null;
  designSettings: DesignSettings;
  notify: (args: { message: string; type: 'success' | 'error' }) => void;
  /** When the anonymize toggle is on, neither the file nor its name may leak the identity */
  isAnonymous?: boolean;
  /** Language the .docx section titles are written in */
  language: 'fr' | 'en';
}

export interface UseExportResult {
  isExporting: boolean;
  isExportingDocx: boolean;
  downloadPDF: () => Promise<void>;
  downloadDocx: () => Promise<void>;
  previewPDF: () => void;
}

/**
 * Every way a CV leaves the app: PDF download, print preview, Word download.
 *
 * One owner so the filename convention and the anonymization rule cannot drift
 * between formats — a .docx that still carried the candidate's name while the
 * PDF hid it would defeat the whole toggle.
 *
 * `downloadPDF` uses serverlessPDF (with text-validation fallback), which
 * toggles isExporting via onLoadingChange.
 *
 * `previewPDF` opens the browser print dialog via renderPDF — no modal, no
 * state. The legacy preview-URL modal was dead code (previewUrl never set)
 * and has been removed.
 */
export function useExport(deps: UseExportDeps): UseExportResult {
  const { cvRef, cvData, designSettings, notify, isAnonymous = false, language } = deps;
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  /** "Marie Dupont - Product Design Leader", identity stripped when anonymized */
  const fileBaseName = isAnonymous
    ? buildPdfFileName('CV Anonyme', cvData?.personal_info?.title)
    : buildPdfFileName(cvData?.personal_info?.name, cvData?.personal_info?.title);

  // The anonymized render prints no identity: expecting it lowered the ratio
  const printedCV = useMemo(() => (cvData && isAnonymous ? maskPersonalInfo(cvData) : cvData), [cvData, isAnonymous]);

  const downloadPDF = useCallback(async () => {
    if (!cvRef.current || isExporting) return;
    const expectedText = printedCV ? extractExpectedText(printedCV, designSettings) : '';
    await serverlessPDF(cvRef.current, designSettings, {
      expectedText,
      fileBaseName,
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
  }, [cvRef, printedCV, designSettings, notify, isExporting, fileBaseName]);

  const downloadDocx = useCallback(async () => {
    if (!cvData || isExportingDocx) return;
    setIsExportingDocx(true);
    try {
      // Lazy: the docx builder is ~300 kB and most sessions never export Word.
      const { exportToDocx } = await import('@/src/shared/lib/export-docx');
      await exportToDocx(
        isAnonymous ? maskPersonalInfo(cvData) : cvData,
        language,
        fileBaseName,
        designSettings.includedSections,
      );
      notify({ message: 'Document Word téléchargé !', type: 'success' });
    } catch (e) {
      console.error('Error exporting DOCX:', e);
      notify({ message: "Erreur lors de l'export Word.", type: 'error' });
    } finally {
      setIsExportingDocx(false);
    }
  }, [cvData, isAnonymous, language, notify, isExportingDocx, fileBaseName, designSettings.includedSections]);

  const previewPDF = useCallback(() => {
    if (!cvRef.current) return;
    const expectedText = printedCV ? extractExpectedText(printedCV, designSettings) : '';
    renderPDF(cvRef.current, designSettings, {
      expectedText,
      onValidation: (result) => {
        if (!result.valid && result.warning) {
          notify({ message: result.warning, type: 'error' });
        }
      },
    });
  }, [cvRef, printedCV, designSettings, notify]);

  return { isExporting, isExportingDocx, downloadPDF, downloadDocx, previewPDF };
}
