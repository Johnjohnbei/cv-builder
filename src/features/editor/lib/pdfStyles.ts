/**
 * Canonical CSS rules for PDF export.
 * Single source of truth — used by both serverless (generate-pdf.ts)
 * and browser fallback (pdfExport.ts renderPDF).
 */
export function getPdfCss(pageLimit: number): string {
  return `
    @page {
      size: A4 portrait;
      margin: 0 !important;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 210mm;
      height: auto;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* Template root: flow naturally, no fixed height */
    .pdf-safe {
      padding-bottom: 10mm !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
    }

    /* Individual blocks (one experience, one education) must not split */
    [data-cv-block] {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    /* Section headers stay with following content */
    [data-cv-section] > h2 {
      break-after: avoid !important;
      page-break-after: avoid !important;
    }

    /* Bullet items stay together */
    [data-cv-block] li {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
  `;
}
