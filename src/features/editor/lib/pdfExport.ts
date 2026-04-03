import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import type { DesignSettings } from '@/src/shared/types';

const A4_WIDTH_PX = 794;  // 210mm at 96dpi
const A4_HEIGHT_PX = 1123; // 297mm at 96dpi

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
 * Export the CV to PDF.
 * 
 * PRINCIPLE: What You See Is What You Get.
 * We capture the CV element exactly as rendered, including its current 
 * zoom transform. The only thing we do is tell html2canvas the "real" 
 * dimensions (pre-transform) so it renders at full resolution.
 */
export async function renderPDF(options: ExportOptions): Promise<ExportResult> {
  const { cvElement, designSettings } = options;
  const pageLimit = designSettings.pageLimit || 1;
  const totalHeightPx = A4_HEIGHT_PX * pageLimit;

  // Get the current transform scale from the element's inline style
  const currentTransform = cvElement.style.transform || 'none';
  const scaleMatch = currentTransform.match(/scale\(([\d.]+)\)/);
  const zoomScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

  // Temporarily set to scale(1) for a clean capture at full resolution
  const savedTransform = cvElement.style.transform;
  cvElement.style.transform = 'scale(1)';
  
  // Wait for reflow
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const canvas = await html2canvas(cvElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Restore transform immediately
    cvElement.style.transform = savedTransform;

    const pdf = new jsPDF({
      orientation: designSettings.orientation || 'portrait',
      unit: 'mm',
      format: designSettings.paperSize || 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();   // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

    if (pageLimit === 1) {
      // Single page: place the full capture
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfWidth, pdfHeight);
    } else {
      // Multi-page: slice the canvas into equal parts
      const canvasPageHeight = Math.round(canvas.height / pageLimit);

      for (let i = 0; i < pageLimit; i++) {
        if (i > 0) pdf.addPage();

        const srcY = i * canvasPageHeight;
        const srcH = Math.min(canvasPageHeight, canvas.height - srcY);
        if (srcH <= 0) break;

        // Create a page-sized slice
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = canvasPageHeight;
        const ctx = pageCanvas.getContext('2d')!;

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        // Draw the slice
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
    }

    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    return { pdf, blob, url };

  } catch (e) {
    // Restore transform even on error
    cvElement.style.transform = savedTransform;
    throw e;
  }
}
