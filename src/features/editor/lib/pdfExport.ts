import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import type { DesignSettings } from '@/src/shared/types';

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
// Safe margin: 5mm ≈ 19px at 96dpi — printers can't print to the edge
const PRINT_MARGIN_PX = 19;

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
 * Before capture: push blocks that straddle page boundaries to the next page.
 * Returns a cleanup function to remove the injected spacers.
 */
function injectPageBreakSpacers(cvElement: HTMLElement, pageLimit: number): () => void {
  if (pageLimit <= 1) return () => {};
  
  const spacers: HTMLElement[] = [];
  const cvRect = cvElement.getBoundingClientRect();
  
  for (let page = 1; page < pageLimit; page++) {
    const pageBreakY = page * A4_HEIGHT_PX;
    
    // Find all blocks near this page boundary
    const blocks = cvElement.querySelectorAll<HTMLElement>('[data-cv-block], [data-cv-section]');
    
    for (const block of blocks) {
      const rect = block.getBoundingClientRect();
      const blockTop = rect.top - cvRect.top;
      const blockBottom = rect.bottom - cvRect.top;
      
      // Block straddles the page boundary (starts before, ends after)
      // Leave a safety zone of PRINT_MARGIN_PX on each side
      if (blockTop < pageBreakY - PRINT_MARGIN_PX && blockBottom > pageBreakY + PRINT_MARGIN_PX) {
        // Calculate how much space to add before this block to push it to next page
        const pushNeeded = pageBreakY - blockTop + PRINT_MARGIN_PX;
        
        // Insert a spacer before this block
        const spacer = document.createElement('div');
        spacer.style.height = `${pushNeeded}px`;
        spacer.style.width = '100%';
        spacer.className = 'pdf-page-spacer';
        block.parentElement?.insertBefore(spacer, block);
        spacers.push(spacer);
        break; // only fix the first straddling block per page boundary
      }
    }
  }
  
  return () => {
    spacers.forEach(s => s.remove());
  };
}

/**
 * Export the CV preview to PDF.
 * 
 * Strategy:
 * 1. Neutralize zoom transform
 * 2. Inject spacers to push blocks that straddle page boundaries
 * 3. Capture with html2canvas
 * 4. Slice into A4 pages
 * 5. Clean up spacers and restore transform
 */
export async function renderPDF(options: ExportOptions): Promise<ExportResult> {
  const { cvElement, designSettings } = options;
  const pageLimit = designSettings.pageLimit || 1;

  const savedTransform = cvElement.style.transform;
  const savedPosition = cvElement.style.position;
  cvElement.style.transform = 'none';
  cvElement.style.position = 'relative';

  // Inject page break spacers to avoid cutting blocks
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const cleanupSpacers = injectPageBreakSpacers(cvElement, pageLimit);
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

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const canvasScale = 2;

    if (pageLimit === 1) {
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfWidth, pdfHeight);
    } else {
      const pageHeightCanvas = A4_HEIGHT_PX * canvasScale;

      for (let i = 0; i < pageLimit; i++) {
        if (i > 0) pdf.addPage();

        const srcY = i * pageHeightCanvas;
        const srcH = Math.min(pageHeightCanvas, canvas.height - srcY);
        if (srcH <= 0) break;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = pageHeightCanvas;
        const ctx = pageCanvas.getContext('2d')!;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
    }

    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    return { pdf, blob, url };

  } finally {
    cleanupSpacers();
    cvElement.style.transform = savedTransform;
    cvElement.style.position = savedPosition;
  }
}
