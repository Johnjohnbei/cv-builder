import {
  Document, Packer, Paragraph, TextRun, ExternalHyperlink,
  AlignmentType, BorderStyle,
} from 'docx';
import { getContactEntries, getEducationLines } from '@/src/features/editor/templates/shared';
import { saveAs } from 'file-saver';
import type { CVData } from '../types';
import {
  getIntro, getActionBullets, getVisibleSkills,
  isHidden, isSkillHidden, shouldShowKPI,
} from '@/src/features/editor/lib/displayModes';
import { getSectionTitle, getSkillCategoryTitle } from '@/src/features/editor/lib/atsRules';
import type { SkillCategoryKey } from '@/src/features/editor/lib/skillDictionary';
import { buildPdfFileName } from '@/src/features/editor/lib/pdfExport';
import { formatDateShort, getCurrentLabel, normalizeProficiency } from '@/src/features/editor/lib/formatting';
import { stripInlineMarkdown } from './text';

export type ExportLanguage = 'fr' | 'en';

/**
 * Builds the docx Document for a CV. Exported separately from exportToDocx so
 * tests can inspect the generated content without triggering a browser download.
 */
export function buildCvDocument(cvData: CVData, language: ExportLanguage = 'fr', includedSections?: string[]): Document {
  const { personal_info, experience, education, skills, languages } = cvData;
  // Same visibility rule as the PDF layout (buildBlocks): a section switched
  // off in the Design tab leaves both formats.
  const shows = (section: string) => !includedSections || includedSections.includes(section);

  const children: Paragraph[] = [];

  // ── Name ──
  children.push(new Paragraph({
    children: [new TextRun({ text: personal_info.name, bold: true, size: 36, font: 'Calibri' })],
    alignment: AlignmentType.LEFT,
    spacing: { after: 60 },
  }));

  // ── Title ──
  if (personal_info.title) {
    children.push(new Paragraph({
      children: [new TextRun({ text: personal_info.title, size: 24, color: '5F6368', font: 'Calibri' })],
      spacing: { after: 120 },
    }));
  }

  // ── Contact line ──
  // Same entries as the PDF header (one owner), and the portfolio is the same
  // clickable label-only hyperlink ("Portfolio Design System") as in the PDF.
  const contactEntries = getContactEntries(personal_info);
  if (contactEntries.length) {
    const contactRun = (text: string) => new TextRun({ text, size: 18, color: '888888', font: 'Calibri' });
    children.push(new Paragraph({
      children: contactEntries.flatMap((entry, i) => [
        ...(i > 0 ? [contactRun('  •  ')] : []),
        entry.href
          ? new ExternalHyperlink({
              link: entry.href,
              children: [new TextRun({ text: entry.value, size: 18, color: '1A73E8', underline: {}, font: 'Calibri' })],
            })
          : contactRun(entry.value),
      ]),
      spacing: { after: 200 },
    }));
  }

  // ── Summary ──
  if (shows('summary') && personal_info.summary) {
    children.push(sectionHeading(getSectionTitle('summary', language)));
    children.push(new Paragraph({
      // Markdown where the PDF renders it: the asterisks used to reach the document
      children: [new TextRun({ text: stripInlineMarkdown(personal_info.summary), size: 20, font: 'Calibri' })],
      spacing: { after: 200 },
    }));
  }

  // ── Experience (mirrors template rendering: intro always, then action bullets per displayMode) ──
  const visibleExps = shows('experience') ? experience.filter(exp => !isHidden(exp)) : [];
  if (visibleExps.length) {
    children.push(sectionHeading(getSectionTitle('experience', language)));
    for (const exp of visibleExps) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: exp.position, bold: true, size: 22, font: 'Calibri' }),
          new TextRun({ text: `  ·  ${exp.company}`, size: 20, color: '5F6368', font: 'Calibri' }),
        ],
        spacing: { before: 120 },
      }));
      const endLabel = exp.current ? getCurrentLabel(language) : formatDateShort(exp.end_date, language);
      children.push(new Paragraph({
        children: [new TextRun({
          text: `${formatDateShort(exp.start_date, language)} - ${endLabel}`,
          size: 18, color: '888888', italics: true, font: 'Calibri',
        })],
        spacing: { after: 60 },
      }));
      const intro = getIntro(exp);
      if (intro) {
        children.push(new Paragraph({
          children: [new TextRun({ text: stripInlineMarkdown(intro), size: 20, font: 'Calibri' })],
          spacing: { after: 40 },
        }));
      }
      for (const bullet of getActionBullets(exp)) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `• ${stripInlineMarkdown(bullet)}`, size: 20, font: 'Calibri' })],
          spacing: { after: 40 },
          indent: { left: 360 },
        }));
      }
      if (shouldShowKPI(exp)) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `📈 ${stripInlineMarkdown(exp.kpi)}`, bold: true, size: 18, color: '1A73E8', font: 'Calibri' })],
          spacing: { after: 60 },
          indent: { left: 360 },
        }));
      }
    }
  }

  // ── Education ──
  if (shows('education') && education.length) {
    children.push(sectionHeading(getSectionTitle('education', language)));
    for (const edu of education) {
      const lines = getEducationLines(edu, language);
      children.push(new Paragraph({
        children: [
          new TextRun({ text: lines.degree, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: `  ·  ${lines.school}`, size: 20, color: '5F6368', font: 'Calibri' }),
          ...(lines.date ? [new TextRun({ text: `  (${lines.date})`, size: 18, color: '888888', font: 'Calibri' })] : []),
        ],
        spacing: { after: 60 },
      }));
    }
  }

  // ── Skills (same visibility rules as templates) ──
  const visibleSkillCats = shows('skills')
    ? skills.filter(cat => !isSkillHidden(cat) && getVisibleSkills(cat).length > 0)
    : [];
  if (visibleSkillCats.length) {
    children.push(sectionHeading(getSectionTitle('skills', language)));
    for (const cat of visibleSkillCats) {
      children.push(new Paragraph({
        children: [
          // Display name, as in the templates: a LinkedIn import stores keys like "technical"
          new TextRun({ text: `${getSkillCategoryTitle(cat.category as SkillCategoryKey, language)}: `, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: getVisibleSkills(cat).join(', '), size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 40 },
      }));
    }
  }

  // ── Languages ──
  if (shows('languages') && languages.length) {
    children.push(sectionHeading(getSectionTitle('languages', language)));
    for (const lang of languages) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${lang.name}: `, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: normalizeProficiency(lang.proficiency, language), size: 20, color: '5F6368', font: 'Calibri' }),
        ],
        spacing: { after: 40 },
      }));
    }
  }

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children,
    }],
  });
}

/**
 * Downloads the CV as a .docx file.
 * `fileBaseName` comes from useExport so PDF and Word land in the recruiter's
 * downloads folder under the exact same name.
 */
export async function exportToDocx(
  cvData: CVData,
  language: ExportLanguage = 'fr',
  fileBaseName?: string,
  includedSections?: string[],
) {
  const doc = buildCvDocument(cvData, language, includedSections);
  const blob = await Packer.toBlob(doc);
  const baseName = fileBaseName || buildPdfFileName(cvData.personal_info.name, cvData.personal_info.title);
  saveAs(blob, `${baseName}.docx`);
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({
      text: text.toUpperCase(),
      bold: true,
      size: 22,
      font: 'Calibri',
      color: '1A73E8',
    })],
    spacing: { before: 300, after: 80 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DADCE0', space: 4 },
    },
  });
}
