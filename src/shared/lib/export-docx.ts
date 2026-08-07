import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle,
} from 'docx';
import { saveAs } from 'file-saver';
import type { CVData } from '../types';
import {
  getIntro, getActionBullets, getVisibleSkills,
  isHidden, isSkillHidden, shouldShowKPI,
} from '@/src/features/editor/lib/displayModes';
import { getSectionTitle } from '@/src/features/editor/lib/atsRules';
import { formatDateShort, getCurrentLabel, normalizeProficiency } from '@/src/features/editor/lib/formatting';

export type ExportLanguage = 'fr' | 'en';

/**
 * Builds the docx Document for a CV. Exported separately from exportToDocx so
 * tests can inspect the generated content without triggering a browser download.
 */
export function buildCvDocument(cvData: CVData, language: ExportLanguage = 'fr'): Document {
  const { personal_info, experience, education, skills, languages } = cvData;

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
  const contactParts = [personal_info.email, personal_info.phone, personal_info.location, personal_info.linkedin].filter(Boolean);
  if (contactParts.length) {
    children.push(new Paragraph({
      children: [new TextRun({ text: contactParts.join('  •  '), size: 18, color: '888888', font: 'Calibri' })],
      spacing: { after: 200 },
    }));
  }

  // ── Summary ──
  if (personal_info.summary) {
    children.push(sectionHeading(getSectionTitle('summary', language)));
    children.push(new Paragraph({
      children: [new TextRun({ text: personal_info.summary, size: 20, font: 'Calibri' })],
      spacing: { after: 200 },
    }));
  }

  // ── Experience (mirrors template rendering: intro always, then action bullets per displayMode) ──
  const visibleExps = experience.filter(exp => !isHidden(exp));
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
          children: [new TextRun({ text: intro, size: 20, font: 'Calibri' })],
          spacing: { after: 40 },
        }));
      }
      for (const bullet of getActionBullets(exp)) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `• ${bullet}`, size: 20, font: 'Calibri' })],
          spacing: { after: 40 },
          indent: { left: 360 },
        }));
      }
      if (shouldShowKPI(exp)) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `📈 ${exp.kpi}`, bold: true, size: 18, color: '1A73E8', font: 'Calibri' })],
          spacing: { after: 60 },
          indent: { left: 360 },
        }));
      }
    }
  }

  // ── Education ──
  if (education.length) {
    children.push(sectionHeading(getSectionTitle('education', language)));
    for (const edu of education) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: edu.degree, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: `  ·  ${edu.school}`, size: 20, color: '5F6368', font: 'Calibri' }),
          new TextRun({ text: `  (${formatDateShort(edu.end_date, language)})`, size: 18, color: '888888', font: 'Calibri' }),
        ],
        spacing: { after: 60 },
      }));
    }
  }

  // ── Skills (same visibility rules as templates) ──
  const visibleSkillCats = skills.filter(cat => !isSkillHidden(cat) && getVisibleSkills(cat).length > 0);
  if (visibleSkillCats.length) {
    children.push(sectionHeading(getSectionTitle('skills', language)));
    for (const cat of visibleSkillCats) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${cat.category}: `, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: getVisibleSkills(cat).join(', '), size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 40 },
      }));
    }
  }

  // ── Languages ──
  if (languages.length) {
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

/** Downloads the CV as a .docx file. `language` defaults to 'fr' for backward compat with existing call sites. */
export async function exportToDocx(cvData: CVData, language: ExportLanguage = 'fr') {
  const doc = buildCvDocument(cvData, language);
  const blob = await Packer.toBlob(doc);
  const filename = `CV_${cvData.personal_info.name?.replace(/\s+/g, '_') || 'Export'}.docx`;
  saveAs(blob, filename);
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
