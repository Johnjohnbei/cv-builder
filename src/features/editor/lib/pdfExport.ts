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
 * Strategy: temporarily reset the element to scale(1) and position:relative,
 * capture at the CSS dimensions (210mm × N×297mm), then restore.
 * This guarantees the PDF matches the preview at 100% zoom.
 */
export async function renderPDF(options: ExportOptions): Promise<ExportResult> {
  const { cvElement, designSettings } = options;
  const pageLimit = designSettings.pageLimit || 1;

  // Save ALL inline styles that might affect layout
  const saved = {
    transform: cvElement.style.transform,
    position: cvElement.style.position,
    top: cvElement.style.top,
    left: cvElement.style.left,
  };

  // Reset to natural size — this is what the user sees at 100% zoom
  cvElement.style.transform = 'none';
  cvElement.style.position = 'relative';
  cvElement.style.top = '0';
  cvElement.style.left = '0';

  // Let the browser recalculate layout
  await new Promise(r => setTimeout(r, 100));

  try {
    // Capture at exactly 210mm × (297mm × pages) = 794px × (1123px × pages)
    const targetW = 794;
    const targetH = 1123 * pageLimit;

    const canvas = await html2canvas(cvElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: targetW,
      height: targetH,
      windowWidth: targetW,
      windowHeight: targetH,
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
    // Restore EVERYTHING
    cvElement.style.transform = saved.transform;
    cvElement.style.position = saved.position;
    cvElement.style.top = saved.top;
    cvElement.style.left = saved.left;
  }
}
