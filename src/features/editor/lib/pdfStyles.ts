/**
 * Canonical CSS rules for PDF export.
 * Single source of truth — used by both serverless (generate-pdf.ts)
 * and browser fallback (pdfExport.ts renderPDF).
 */
export function getPdfCss(_pageLimit: number): string {
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

    /* Pre-paginated pages: each .cv-page is exactly one A4 page */
    .cv-page {
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .cv-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    /* Template root: flow naturally */
    .pdf-safe {
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
    }

    /* Fallback: keep blocks together if CSS pagination still applies */
    [data-cv-block] {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    [data-cv-section] > h2 {
      break-after: avoid !important;
      page-break-after: avoid !important;
    }
  `;
}
