import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import type { DesignSettings } from '@/src/shared/types';

interface ExportResult {
  pdf: jsPDF;
  blob: Blob;
  url: string;
}

/**
 * WYSIWYG PDF export.
 * 
 * Temporarily sets scale(1) on the original element to capture at real A4 size.
 * The caller MUST set isExporting=true before calling to prevent auto-fit.
 * transform is restored in the finally block.
 */
export async function renderPDF(
  cvElement: HTMLElement,
  designSettings: DesignSettings,
): Promise<ExportResult> {
  const pageLimit = designSettings.pageLimit || 1;

  // Save and temporarily reset for capture
  const saved = {
    transform: cvElement.style.transform,
    border: cvElement.style.border,
    boxShadow: cvElement.style.boxShadow,
  };
  cvElement.style.transform = 'scale(1)';
  cvElement.style.border = 'none';
  cvElement.style.boxShadow = 'none';

  await new Promise(r => setTimeout(r, 200));

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
    // Restore everything
    cvElement.style.transform = saved.transform;
    cvElement.style.border = saved.border;
    cvElement.style.boxShadow = saved.boxShadow;
  }
}
