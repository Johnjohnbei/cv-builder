import type { DesignSettings } from '@/src/shared/types';

/**
 * WYSIWYG PDF export using the browser's native print dialog.
 * 
 * This is the most reliable method — the browser handles all CSS rendering
 * perfectly, including transforms, fonts, colors, and page breaks.
 * 
 * Opens a popup window with only the CV content, then calls window.print().
 * The user selects "Save as PDF" in the print dialog.
 */
export function printCV(cvElement: HTMLElement, designSettings: DesignSettings): void {
  const pageLimit = designSettings.pageLimit || 1;
  
  // Clone the CV content
  const clone = cvElement.cloneNode(true) as HTMLElement;
  
  // Reset any preview-specific styles on the clone
  clone.style.transform = 'none';
  clone.style.position = 'relative';
  clone.style.width = '210mm';
  clone.style.height = `${297 * pageLimit}mm`;
  clone.style.overflow = 'hidden';
  clone.style.border = 'none';
  clone.style.boxShadow = 'none';
  clone.style.margin = '0';
  
  // Get all stylesheets from the current page
  const styles = Array.from(document.styleSheets)
    .map(sheet => {
      try {
        return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
      } catch {
        // Cross-origin stylesheets can't be read
        return '';
      }
    })
    .join('\n');

  // Open print window
  const printWindow = window.open('', '_blank', 'width=794,height=1123');
  if (!printWindow) {
    alert("Impossible d'ouvrir la fenêtre d'impression. Autorisez les popups.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>CV Export</title>
      <style>
        ${styles}
        
        @page {
          size: A4 portrait;
          margin: 0;
        }
        
        @media print {
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          [data-cv-block] {
            break-inside: avoid !important;
          }
        }
        
        body {
          margin: 0;
          padding: 0;
          background: white;
        }
      </style>
      ${Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(link => link.outerHTML)
        .join('\n')}
    </head>
    <body>
      ${clone.outerHTML}
    </body>
    </html>
  `);
  
  printWindow.document.close();
  
  // Wait for styles and fonts to load, then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
  
  // Fallback if onload doesn't fire
  setTimeout(() => {
    try { printWindow.print(); } catch {}
  }, 2000);
}
