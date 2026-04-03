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
 * WYSIWYG PDF export.
 * 
 * The cvElement has transform:scale(zoom) for the preview. We must temporarily
 * reset it to scale(1) so html2canvas captures at the real CSS dimensions
 * (210mm × N×297mm). After capture, we restore the original transform.
 * 
 * This is the ONLY DOM change we make, and it's restored in a finally block.
 */
export async function renderPDF(options: ExportOptions): Promise<ExportResult> {
  const { cvElement, designSettings } = options;
  const pageLimit = designSettings.pageLimit || 1;

  // Save and reset transform to capture at real CSS size
  const savedTransform = cvElement.style.transform;
  cvElement.style.transform = 'scale(1)';

  // Wait for browser to reflow at scale(1)
  await new Promise(r => setTimeout(r, 150));

  try {
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
    // Always restore the original transform
    cvElement.style.transform = savedTransform;
  }
}
