import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import type { DesignSettings } from '@/src/shared/types';

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

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
 * Export the CV preview to PDF.
 * 
 * Strategy: capture the CV element AS-IS (with overflow:hidden and fixed height).
 * This ensures the PDF matches exactly what the user sees in the preview.
 * For multi-page, we capture the full container (pageLimit × 297mm) and slice 
 * it into individual A4 pages.
 */
export async function renderPDF(options: ExportOptions): Promise<ExportResult> {
  const { cvElement, designSettings } = options;
  const pageLimit = designSettings.pageLimit || 1;

  // Save and neutralize any CSS transform (zoom) — we want 1:1 capture
  const savedTransform = cvElement.style.transform;
  const savedPosition = cvElement.style.position;
  cvElement.style.transform = 'none';
  cvElement.style.position = 'relative';

  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const canvas = await html2canvas(cvElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: A4_WIDTH_PX,
      height: A4_HEIGHT_PX * pageLimit,
      windowWidth: A4_WIDTH_PX,
    });

    const pdf = new jsPDF({
      orientation: designSettings.orientation || 'portrait',
      unit: 'mm',
      format: designSettings.paperSize || 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();  // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm
    const canvasScale = 2; // matches html2canvas scale

    if (pageLimit === 1) {
      // Single page — just place the full image
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfWidth, pdfHeight);
    } else {
      // Multi-page — slice the canvas into pageLimit pages
      const pageHeightCanvas = A4_HEIGHT_PX * canvasScale; // pixels per page in canvas space

      for (let i = 0; i < pageLimit; i++) {
        if (i > 0) pdf.addPage();

        const srcY = i * pageHeightCanvas;
        const srcH = Math.min(pageHeightCanvas, canvas.height - srcY);
        if (srcH <= 0) break;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = pageHeightCanvas; // always full page height
        const ctx = pageCanvas.getContext('2d')!;

        // Fill with white (in case content is shorter than page)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        // Draw the slice
        ctx.drawImage(
          canvas,
          0, srcY, canvas.width, srcH,
          0, 0, canvas.width, srcH,
        );

        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
    }

    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    return { pdf, blob, url };

  } finally {
    cvElement.style.transform = savedTransform;
    cvElement.style.position = savedPosition;
  }
}
