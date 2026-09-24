/**
 * Client-side PDF text extraction using pdf.js
 * Extracts raw text from PDF files without any API call.
 * Works for 95%+ of CVs (Word, Google Docs, LinkedIn exports).
 */
import * as pdfjsLib from 'pdfjs-dist';
import type { CVData } from '../shared/types';
import { profileFromTokens, type Token } from './linkedin-parser';

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
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items
        .filter((item) => 'str' in item)
        .map((item) => (item as { str: string }).str);
      pages.push(strings.join(' '));
    }
  } finally {
    // Frees the worker-side document: without it every import kept its PDF in memory
    await pdf.destroy();
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

/** The text items of every page, with the font size and position the LinkedIn parser reads */
async function extractTokens(file: File): Promise<Token[]> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const tokens: Token[] = [];
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const content = await (await pdf.getPage(p)).getTextContent();
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        tokens.push({
          text:     item.str.trim(),
          fontSize: Math.round(item.transform[0] * 100) / 100,
          x:        Math.round(item.transform[4]),
          y:        Math.round(item.transform[5]),
          page:     p,
        });
      }
    }
  } finally {
    await pdf.destroy();
  }
  return tokens;
}

/**
 * A LinkedIn export read locally: instant, no API call. Null for any other PDF,
 * or when the parser fails, so the caller falls back to the AI extraction.
 */
export async function parseLinkedInPDF(file: File): Promise<CVData | null> {
  try {
    return profileFromTokens(await extractTokens(file));
  } catch (err) {
    console.warn('[Calibre] LinkedIn parser failed, falling back to AI:', err);
    return null;
  }
}
