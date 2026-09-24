/**
 * Canonical CSS rules for PDF export.
 * Single source of truth — used by both serverless (generate-pdf.ts)
 * and browser fallback (pdf-export.ts renderPDF).
 */
export function getPdfCss(): string {
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
    }
    /* Break after every page but the last. Each page sits alone inside its
       preview slot, so the former ".cv-page:last-child" reset matched EVERY
       page and no break was ever requested: pagination only held because the
       pages stack at exactly 297mm. */
    .cv-page-slot:not(:last-child) .cv-page,
    .pdf-safe > .cv-page:not(:last-child) {
      page-break-after: always;
      break-after: page;
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
