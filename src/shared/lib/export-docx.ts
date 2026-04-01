import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, TabStopPosition, TabStopType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { CVData } from '../types';

export async function exportToDocx(cvData: CVData) {
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
    children.push(sectionHeading('Profil'));
    children.push(new Paragraph({
      children: [new TextRun({ text: personal_info.summary, size: 20, font: 'Calibri' })],
      spacing: { after: 200 },
    }));
  }

  // ── Experience ──
  if (experience.length) {
    children.push(sectionHeading('Expérience Professionnelle'));
    for (const exp of experience) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: exp.position, bold: true, size: 22, font: 'Calibri' }),
          new TextRun({ text: `  —  ${exp.company}`, size: 20, color: '5F6368', font: 'Calibri' }),
        ],
        spacing: { before: 120 },
      }));
      children.push(new Paragraph({
        children: [new TextRun({
          text: `${exp.start_date} — ${exp.current ? 'Présent' : exp.end_date || ''}`,
          size: 18, color: '888888', italics: true, font: 'Calibri',
        })],
        spacing: { after: 60 },
      }));
      for (const bullet of exp.description || []) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `• ${bullet}`, size: 20, font: 'Calibri' })],
          spacing: { after: 40 },
          indent: { left: 360 },
        }));
      }
    }
  }

  // ── Education ──
  if (education.length) {
    children.push(sectionHeading('Formation'));
    for (const edu of education) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: edu.degree, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: `  —  ${edu.school}`, size: 20, color: '5F6368', font: 'Calibri' }),
          new TextRun({ text: `  (${edu.end_date || ''})`, size: 18, color: '888888', font: 'Calibri' }),
        ],
        spacing: { after: 60 },
      }));
    }
  }

  // ── Skills ──
  if (skills.length) {
    children.push(sectionHeading('Compétences'));
    for (const cat of skills) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${cat.category}: `, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: cat.items.join(', '), size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 40 },
      }));
    }
  }

  // ── Languages ──
  if (languages.length) {
    children.push(sectionHeading('Langues'));
    for (const lang of languages) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${lang.name}: `, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: lang.proficiency, size: 20, color: '5F6368', font: 'Calibri' }),
        ],
        spacing: { after: 40 },
      }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `CV_${personal_info.name?.replace(/\s+/g, '_') || 'Export'}.docx`;
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
