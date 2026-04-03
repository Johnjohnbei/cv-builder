import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import type { DesignSettings } from '@/src/shared/types';

interface ExportResult {
  pdf: jsPDF;
  blob: Blob;
  url: string;
}

/**
 * WYSIWYG PDF export using an offscreen clone.
 * 
 * NEVER modifies the original element. Instead:
 * 1. Clone the CV element
 * 2. Place the clone offscreen at exact A4 dimensions (no transform)
 * 3. Capture the clone with html2canvas
 * 4. Remove the clone
 * 5. Generate PDF from the capture
 */
export async function renderPDF(
  cvElement: HTMLElement,
  designSettings: DesignSettings,
): Promise<ExportResult> {
  const pageLimit = designSettings.pageLimit || 1;

  // Clone and prepare offscreen
  const clone = cvElement.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.position = 'absolute';
  clone.style.top = '-99999px';
  clone.style.left = '-99999px';
  clone.style.width = '210mm';
  clone.style.height = `${297 * pageLimit}mm`;
  clone.style.overflow = 'hidden';
  clone.style.border = 'none';
  clone.style.boxShadow = 'none';
  clone.style.zIndex = '-1';
  document.body.appendChild(clone);

  // Wait for layout
  await new Promise(r => setTimeout(r, 200));

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF({
      orientation: designSettings.orientation || 'portrait',
      unit: 'mm',
      format: designSettings.paperSize || 'a4',
    });

    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    if (pageLimit === 1) {
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfW, pdfH);
    } else {
      const sliceH = Math.round(canvas.height / pageLimit);
      for (let i = 0; i < pageLimit; i++) {
        if (i > 0) pdf.addPage();
        const srcY = i * sliceH;
        const srcH = Math.min(sliceH, canvas.height - srcY);
        if (srcH <= 0) break;

        const page = document.createElement('canvas');
        page.width = canvas.width;
        page.height = sliceH;
        const ctx = page.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, page.width, page.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        pdf.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfW, pdfH);
      }
    }

    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    return { pdf, blob, url };
  } finally {
    document.body.removeChild(clone);
  }
}

/** Print using native browser dialog (alternative) */
export function printCV(cvElement: HTMLElement, designSettings: DesignSettings): void {
  const pageLimit = designSettings.pageLimit || 1;
  const clone = cvElement.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.position = 'relative';
  clone.style.width = '210mm';
  clone.style.height = `${297 * pageLimit}mm`;
  clone.style.overflow = 'hidden';
  clone.style.border = 'none';
  clone.style.boxShadow = 'none';

  const styles = Array.from(document.styleSheets).map(s => {
    try { return Array.from(s.cssRules).map(r => r.cssText).join('\n'); } catch { return ''; }
  }).join('\n');

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><style>${styles}
    @page { size: A4; margin: 0; }
    body { margin: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    [data-cv-block] { break-inside: avoid !important; }
  </style>${Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.outerHTML).join('')}</head><body>${clone.outerHTML}</body></html>`);
  w.document.close();
  setTimeout(() => { try { w.print(); } catch {} }, 1000);
}
