import type { DesignSettings } from '@/src/shared/types';
import html2pdf from 'html2pdf.js';

/**
 * WYSIWYG PDF export using html2pdf.js.
 * 
 * html2pdf.js handles the full pipeline: html2canvas capture → jsPDF generation
 * with proper margin handling, page breaks, and dimension calculations.
 * 
 * We temporarily set scale(1) on the element for correct capture dimensions.
 * The caller MUST set isExporting=true to prevent auto-fit interference.
 */
export async function renderPDF(
  cvElement: HTMLElement,
  designSettings: DesignSettings,
): Promise<void> {
  const pageLimit = designSettings.pageLimit || 1;

  // Save and reset for capture
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
    const opts: any = {
      margin: 0,
      filename: 'CV_Optimise.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
      },
      pagebreak: {
        mode: ['avoid-all', 'css'],
        avoid: ['[data-cv-block]', '[data-cv-section]'],
      },
    };

    await html2pdf().set(opts).from(cvElement).save();
  } finally {
    cvElement.style.transform = saved.transform;
    cvElement.style.border = saved.border;
    cvElement.style.boxShadow = saved.boxShadow;
  }
}
