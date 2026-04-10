import type { DesignSettings } from '@/src/shared/types';
import { validateCVTextExtractability, type ValidationResult } from './pdfValidation';
import { getPdfCss } from './pdfStyles';

// ─── Types ───

export interface RenderPDFOptions {
  expectedText?: string;
  onValidation?: (result: ValidationResult) => void;
}

export interface ServerlessPDFOptions {
  expectedText?: string;
  onValidation?: (result: ValidationResult) => void;
  onLoadingChange?: (loading: boolean) => void;
  onFallback?: (reason: string) => void;
}

// ─── DOM Serialization ───

/**
 * Extract CV HTML and all stylesheets from the live DOM.
 * Returns a payload suitable for the serverless PDF endpoint.
 */
export function serializeCV(cvElement: HTMLElement): { html: string; styles: string } {
  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(link => link.outerHTML)
    .join('\n');

  const inlineStyles = Array.from(document.styleSheets)
    .map(sheet => {
      try { return Array.from(sheet.cssRules).map(r => r.cssText).join('\n'); }
      catch { return ''; }
    })
    .join('\n');

  const clone = cvElement.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.position = 'relative';
  clone.style.top = '0';
  clone.style.left = '0';
  clone.style.width = '210mm';
  clone.style.height = 'auto';
  clone.style.overflow = 'visible';
  clone.style.border = 'none';
  clone.style.boxShadow = 'none';
  clone.style.margin = '0';

  return {
    html: clone.outerHTML,
    styles: `${styleLinks}\n<style>${inlineStyles}</style>`,
  };
}

// ─── Serverless PDF Generation ───

/**
 * Generate PDF via the serverless endpoint.
 * Falls back to window.print() via renderPDF on any error.
 */
export async function serverlessPDF(
  cvElement: HTMLElement,
  designSettings: DesignSettings,
  options?: ServerlessPDFOptions,
): Promise<void> {
  // Count actual pages from the DOM
  const pageCount = cvElement.querySelectorAll('.cv-page').length || 1;

  // 1. Run DOM pre-check validation (D-14)
  if (options?.expectedText && options?.onValidation) {
    const renderedText = cvElement.innerText || cvElement.textContent || '';
    const result = validateCVTextExtractability(renderedText, options.expectedText);
    options.onValidation(result);
  }

  // 2. Notify loading start
  options?.onLoadingChange?.(true);

  try {
    // 3. Serialize CV DOM
    const { html, styles } = serializeCV(cvElement);

    // 4. POST to serverless function
    const response = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, styles, pageLimit: pageCount }),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    // 5. Download PDF via blob URL (D-12)
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.download = `CV_${date}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    // 6. Fallback to window.print() (D-13)
    console.error('Serverless PDF generation failed:', error);
    options?.onFallback?.('La generation serveur a echoue. Utilisation de l\'impression navigateur.');
    renderPDF(cvElement, designSettings, {
      expectedText: options?.expectedText,
      onValidation: options?.onValidation,
    });
  } finally {
    options?.onLoadingChange?.(false);
  }
}

// ─── Legacy PDF Export (fallback) ───

/**
 * PDF export via browser print dialog.
 * Used as fallback when serverless generation fails.
 */
export function renderPDF(
  cvElement: HTMLElement,
  designSettings: DesignSettings,
  options?: RenderPDFOptions,
): void {
  const pageCount = cvElement.querySelectorAll('.cv-page').length || 1;

  // Create hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '210mm';
  iframe.style.height = `${297 * pageCount}mm`;
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
  clone.style.height = 'auto';
  clone.style.overflow = 'visible';
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
    ${getPdfCss(pageCount)}
  </style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`);
  doc.close();

  // Wait for styles + fonts to load, then validate and print
  iframe.onload = () => {
    // Run text extractability validation before printing
    if (options?.expectedText && options?.onValidation) {
      const renderedText = doc.body?.innerText || doc.body?.textContent || '';
      const result = validateCVTextExtractability(renderedText, options.expectedText);
      options.onValidation(result);
    }

    setTimeout(() => {
      iframe.contentWindow?.print();
      // Remove iframe after print dialog closes
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch {}
      }, 1000);
    }, 500);
  };
}
