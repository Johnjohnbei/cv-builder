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
  /** Base name for the downloaded file (without extension). Default: "CV" */
  fileBaseName?: string;
}

/**
 * Build the exported file's base name from the candidate identity.
 *
 * ("Jean Dupont", "Product Design Leader") → "Jean Dupont - Product Design Leader"
 *
 * Recruiters file attachments by what they read on screen, so the name and the
 * targeted role are kept verbatim (accents included) rather than slugified.
 * Only the characters Windows/macOS reject in a filename are stripped.
 */
export function buildPdfFileName(candidateName?: string, jobTitle?: string): string {
  const clean = (s?: string) => (s ?? '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = [clean(candidateName), clean(jobTitle)].filter(Boolean);
  return parts.length > 0 ? parts.join(' - ') : 'CV';
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
 * POST an HTML document to the PDF endpoint and hand the result to the browser
 * as a download.
 *
 * The single owner of "turn HTML into a downloaded PDF". Any document the app
 * exports goes through here — the CV serialized from the live DOM, and the
 * cover letter built as standalone markup — so the response checks and the
 * blob plumbing exist once.
 */
export async function downloadPdfFromHtml(html: string, styles: string, fileBaseName: string): Promise<void> {
  const response = await fetch('/api/generate-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, styles }),
  });

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`);
  }

  // A dev server or a misrouted rewrite can answer 200 with index.html.
  // Without this check that HTML would be saved as a .pdf the reader can't
  // open — fail loudly instead.
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/pdf')) {
    throw new Error(`Expected application/pdf, got "${contentType}"`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileBaseName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate PDF via the serverless endpoint.
 * Falls back to window.print() via renderPDF on any error.
 */
export async function serverlessPDF(
  cvElement: HTMLElement,
  designSettings: DesignSettings,
  options?: ServerlessPDFOptions,
): Promise<void> {
  // 1. Run DOM pre-check validation (D-14)
  if (options?.expectedText && options?.onValidation) {
    const renderedText = cvElement.innerText || cvElement.textContent || '';
    const result = validateCVTextExtractability(renderedText, options.expectedText);
    options.onValidation(result);
  }

  // 2. Notify loading start
  options?.onLoadingChange?.(true);

  try {
    const { html, styles } = serializeCV(cvElement);
    await downloadPdfFromHtml(html, styles, options?.fileBaseName || 'CV');
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
    ${getPdfCss()}
  </style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`);
  doc.close();

  // No iframe.onload here: assigning it AFTER doc.close() races the load event
  // (already fired on some browsers → nothing printed, iframe leaked).
  // doc.fonts.ready resolves once webfonts are in — deterministic, no timer.
  const printWhenReady = async () => {
    // Run text extractability validation before printing
    if (options?.expectedText && options?.onValidation) {
      const renderedText = doc.body?.innerText || doc.body?.textContent || '';
      const result = validateCVTextExtractability(renderedText, options.expectedText);
      options.onValidation(result);
    }

    try { await doc.fonts.ready; } catch { /* print with fallback fonts */ }
    await new Promise(requestAnimationFrame);
    iframe.contentWindow?.print();
    // Remove iframe after print dialog closes
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch {}
    }, 1000);
  };
  void printWhenReady();
}
