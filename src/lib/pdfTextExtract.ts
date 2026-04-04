/**
 * Client-side PDF text extraction using pdf.js
 * Extracts raw text from PDF files without any API call.
 * Works for 95%+ of CVs (Word, Google Docs, LinkedIn exports).
 */
import * as pdfjsLib from 'pdfjs-dist';

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

/**
 * Extract text content from a PDF file.
 * @param file - PDF File object from file input / drag-and-drop
 * @returns Full text content of the PDF, pages separated by newlines
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .filter((item): item is { str: string } => 'str' in item)
      .map((item) => item.str);
    pages.push(strings.join(' '));
  }

  const fullText = pages.join('\n\n');

  // If we got very little text, the PDF is probably a scanned image
  if (fullText.trim().length < 50) {
    throw new Error('PDF_NO_TEXT');
  }

  // Return ALL text — no truncation.
  // LinkedIn PDFs can be 18+ pages but every experience matters.
  return fullText;
}
