import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import type { PersonalInfo } from '../types';
import type { ExportLanguage } from './export-docx';
import type { CoverLetterData } from '@/src/features/editor/hooks/useCoverLetter';
import { stripAccents } from './text';

export interface ExportLetterOptions {
  letter: CoverLetterData;
  personalInfo: PersonalInfo;
  companyName?: string;
  language?: ExportLanguage;
}

const FONT = 'Calibri';
const BODY_SIZE = 22; // half-points: 11pt, standard letter body

/** Lettre_<Entreprise>.docx (FR) / Cover_Letter_<Company>.docx (EN), accents removed. */
export function buildLetterFilename(companyName: string | undefined, language: ExportLanguage = 'fr'): string {
  const prefix = language === 'en' ? 'Cover_Letter' : 'Lettre';
  const slug = stripAccents(companyName?.trim() || '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug ? `${prefix}_${slug}.docx` : `${prefix}.docx`;
}

/** Localized long date, e.g. "7 août 2026" / "August 7, 2026", prefixed with the sender's city when known. */
export function buildLetterDateLine(language: ExportLanguage, location?: string, now: Date = new Date()): string {
  const date = now.toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const city = location?.trim();
  if (!city) return date;
  return language === 'en' ? `${city}, ${date}` : `${city}, le ${date}`;
}

function bodyParagraph(text: string, spacingAfter = 200): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: BODY_SIZE, font: FONT })],
    spacing: { after: spacingAfter },
  });
}

/**
 * Builds the docx Document for a cover letter. Exported separately from
 * exportLetterToDocx so tests can inspect the content without a browser download.
 */
export function buildLetterDocument(options: ExportLetterOptions): Document {
  const { letter, personalInfo, language = 'fr' } = options;

  const children: Paragraph[] = [];

  // ── Sender block ──
  children.push(new Paragraph({
    children: [new TextRun({ text: personalInfo.name, bold: true, size: 24, font: FONT })],
    spacing: { after: 40 },
  }));
  const contactParts = [personalInfo.email, personalInfo.phone, personalInfo.location].filter(Boolean);
  if (contactParts.length) {
    children.push(new Paragraph({
      children: [new TextRun({ text: contactParts.join('  •  '), size: 18, color: '888888', font: FONT })],
      spacing: { after: 240 },
    }));
  }

  // ── Date ──
  children.push(new Paragraph({
    children: [new TextRun({ text: buildLetterDateLine(language, personalInfo.location), size: BODY_SIZE, font: FONT })],
    spacing: { after: 240 },
  }));

  // ── Subject ──
  if (letter.subject) {
    const label = language === 'en' ? 'Subject: ' : 'Objet : ';
    children.push(new Paragraph({
      children: [new TextRun({ text: `${label}${letter.subject}`, bold: true, size: BODY_SIZE, font: FONT })],
      spacing: { after: 240 },
    }));
  }

  // ── Greeting ──
  children.push(bodyParagraph(letter.greeting));

  // ── Body: double line breaks separate paragraphs ──
  for (const para of letter.body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)) {
    children.push(bodyParagraph(para));
  }

  // ── Closing + signature ──
  children.push(bodyParagraph(letter.closing, 240));
  children.push(new Paragraph({
    children: [new TextRun({ text: personalInfo.name, bold: true, size: BODY_SIZE, font: FONT })],
  }));

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        },
      },
      children,
    }],
  });
}

/** Downloads the cover letter as a .docx file. */
export async function exportLetterToDocx(options: ExportLetterOptions): Promise<void> {
  const doc = buildLetterDocument(options);
  const blob = await Packer.toBlob(doc);
  saveAs(blob, buildLetterFilename(options.companyName, options.language ?? 'fr'));
}

// ─── PDF ───────────────────────────────────────────────────────────

/** Escape user text before it lands in the generated markup. */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/**
 * The letter as a standalone A4 document.
 *
 * Built as markup rather than serialized from the DOM: the drawer renders form
 * fields, not a letter, so there is nothing on screen worth photographing.
 * Padding lives on the container because the print CSS forces `@page` margins
 * to zero for the CV's pre-paginated pages.
 */
export function buildLetterHtml(opts: ExportLetterOptions): string {
  const { letter, personalInfo, language = 'fr' } = opts;
  const contact = [personalInfo.email, personalInfo.phone, personalInfo.location]
    .filter(Boolean).map(v => escapeHtml(v as string)).join(' · ');
  const subjectLabel = language === 'en' ? 'Subject: ' : 'Objet : ';
  const paragraphs = letter.body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${escapeHtml(p)}</p>`).join('\n');

  return `<div class="letter">
  <header>
    <p class="sender-name">${escapeHtml(personalInfo.name || '')}</p>
    ${contact ? `<p class="sender-contact">${contact}</p>` : ''}
  </header>
  <p class="date">${escapeHtml(buildLetterDateLine(language, personalInfo.location))}</p>
  ${letter.subject ? `<p class="subject">${subjectLabel}${escapeHtml(letter.subject)}</p>` : ''}
  <p class="greeting">${escapeHtml(letter.greeting)}</p>
  ${paragraphs}
  <p class="closing">${escapeHtml(letter.closing)}</p>
  <p class="signature">${escapeHtml(personalInfo.name || '')}</p>
</div>`;
}

const LETTER_PDF_CSS = `
  .letter {
    width: 210mm; min-height: 297mm; box-sizing: border-box;
    padding: 25mm 22mm;
    font-family: Calibri, Carlito, Arial, sans-serif;
    font-size: 11pt; line-height: 1.55; color: #1a1a1a;
  }
  .letter p { margin: 0 0 11pt; }
  .letter .sender-name { font-weight: 700; font-size: 12pt; margin-bottom: 2pt; }
  .letter .sender-contact { color: #555; font-size: 9.5pt; }
  .letter .date { margin-top: 18pt; text-align: right; }
  .letter .subject { font-weight: 700; margin-top: 14pt; margin-bottom: 16pt; }
  .letter .greeting { margin-bottom: 12pt; }
  .letter .closing { margin-top: 14pt; }
  .letter .signature { font-weight: 700; margin-top: 6pt; }
`;

/** Download the cover letter as a laid-out PDF, through the same endpoint as the CV. */
export async function exportLetterToPdf(opts: ExportLetterOptions): Promise<void> {
  const { downloadPdfFromHtml } = await import('@/src/features/editor/lib/pdf-export');
  const baseName = buildLetterFilename(opts.companyName, opts.language).replace(/\.docx$/, '');
  await downloadPdfFromHtml(buildLetterHtml(opts), `<style>${LETTER_PDF_CSS}</style>`, baseName);
}
