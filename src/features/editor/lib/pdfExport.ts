import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import type { DesignSettings } from '@/src/shared/types';

interface ExportOptions {
  cvElement: HTMLElement;
  designSettings: DesignSettings;
}

interface ExportResult {
  pdf: jsPDF;
  blob: Blob;
  url: string;
}

/**
 * WYSIWYG PDF export: captures the CV element EXACTLY as displayed.
 * 
 * No DOM manipulation at all. We capture the element including its
 * current zoom transform, then scale the image to fit A4 pages in the PDF.
 */
export async function renderPDF(options: ExportOptions): Promise<ExportResult> {
  const { cvElement, designSettings } = options;
  const pageLimit = designSettings.pageLimit || 1;

  // Capture exactly what's on screen — no style changes
  const canvas = await html2canvas(cvElement, {
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

  const pdfWidth = pdf.internal.pageSize.getWidth();   // 210mm
  const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

  if (pageLimit === 1) {
    // Single page: scale the entire capture to fit A4
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfWidth, pdfHeight);
  } else {
    // Multi-page: slice the canvas into equal vertical segments
    const sliceHeight = Math.round(canvas.height / pageLimit);

    for (let i = 0; i < pageLimit; i++) {
      if (i > 0) pdf.addPage();

      const srcY = i * sliceHeight;
      const srcH = Math.min(sliceHeight, canvas.height - srcY);
      if (srcH <= 0) break;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const ctx = pageCanvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

      pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfWidth, pdfHeight);
    }
  }

  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  return { pdf, blob, url };
}
