import type { DesignSettings } from '@/src/shared/types';

/**
 * PDF export via browser print dialog.
 * 
 * This is the ONLY reliable way to get WYSIWYG PDF output.
 * The browser's print engine renders CSS perfectly — same engine as the preview.
 * 
 * Approach: create an iframe with the CV content + all stylesheets, then print it.
 */
export function renderPDF(
  cvElement: HTMLElement,
  designSettings: DesignSettings,
): void {
  const pageLimit = designSettings.pageLimit || 1;

  // Create hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '210mm';
  iframe.style.height = `${297 * pageLimit}mm`;
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;

  // Copy all stylesheets
  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(link => link.outerHTML)
    .join('\n');

  const inlineStyles = Array.from(document.styleSheets)
    .map(sheet => {
      try { return Array.from(sheet.cssRules).map(r => r.cssText).join('\n'); }
      catch { return ''; }
    })
    .join('\n');

  // Clone the CV content
  const clone = cvElement.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.position = 'relative';
  clone.style.top = '0';
  clone.style.left = '0';
  clone.style.width = '210mm';
  clone.style.height = `${297 * pageLimit}mm`;
  clone.style.overflow = 'hidden';
  clone.style.border = 'none';
  clone.style.boxShadow = 'none';
  clone.style.margin = '0';

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CV Export</title>
  ${styleLinks}
  <style>
    ${inlineStyles}
    
    @page {
      size: A4 portrait;
      margin: 0;
    }
    
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 210mm;
      height: ${297 * pageLimit}mm;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    [data-cv-block] {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    
    [data-cv-section] {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
  </style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`);
  doc.close();

  // Wait for styles + fonts to load, then print
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      // Remove iframe after print dialog closes
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  // Fallback
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch {}
      }, 1000);
    } catch {}
  }, 3000);
}
