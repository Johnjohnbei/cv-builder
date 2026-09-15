import { describe, it, expect } from 'vitest';
import { Packer } from 'docx';
// ponytail: jszip is a transitive dep of docx (test-only use), avoids adding a dependency
import JSZip from 'jszip';
import type { CVData } from '../types';
import { buildCvDocument } from './export-docx';

const mockCV: CVData = {
  personal_info: {
    name: 'Jean Dupont',
    email: 'jean@example.com',
    phone: '0600000000',
    location: 'Paris',
    title: 'Product Manager',
    summary: 'Resume summary text.',
    linkedin: 'linkedin.com/in/jean',
  },
  experience: [
    {
      company: 'AlphaCorp',
      position: 'Senior PM',
      start_date: 'Janvier 2020',
      end_date: '',
      current: true,
      description: ['Intro alpha line', 'Bullet alpha A', 'Bullet alpha B', 'Bullet alpha C'],
      displayMode: 'normal',
      kpi: 'KPI alpha metric',
    },
    {
      company: 'BetaCorp',
      position: 'PM',
      start_date: 'Mars 2018',
      end_date: 'Décembre 2019',
      current: false,
      description: ['Intro beta line', 'Bullet beta A'],
      displayMode: 'compact',
    },
    {
      company: 'HiddenCorp',
      position: 'Intern',
      start_date: '2016',
      end_date: '2017',
      current: false,
      description: ['Hidden bullet'],
      displayMode: 'hidden',
    },
    {
      company: 'GammaCorp',
      position: 'Lead PM',
      start_date: '2021-05',
      end_date: '',
      current: true,
      description: ['Bullet gamma A', 'Bullet gamma B', 'Bullet gamma C', 'Bullet gamma D'],
      intro: 'Dedicated gamma intro',
      displayMode: 'extended',
      kpi: 'Team of 12',
    },
  ],
  education: [
    { school: 'HEC', degree: 'Master Management', start_date: '2012', end_date: '2015' },
  ],
  skills: [
    { category: 'Produit', items: ['s1', 's2', 's3', 's4'], displayMode: 'compact' },
    { category: 'SecretSkills', items: ['x1'], displayMode: 'hidden' },
    { category: 'Outils', items: ['Jira', 'Figma'] },
  ],
  languages: [
    { name: 'Anglais', proficiency: 'Full Professional' },
  ],
};

async function toXml(cv: CVData, language?: 'fr' | 'en'): Promise<string> {
  const buffer = await Packer.toBuffer(buildCvDocument(cv, language));
  const zip = await JSZip.loadAsync(buffer);
  return zip.file('word/document.xml')!.async('string');
}

describe('buildCvDocument (fr, default)', () => {
  it('generates without throwing and contains ATS FR section titles', async () => {
    const xml = await toXml(mockCV);
    expect(xml).toContain('EXPÉRIENCE PROFESSIONNELLE');
    expect(xml).toContain('PROFIL PROFESSIONNEL');
    expect(xml).toContain('FORMATION');
    expect(xml).toContain('COMPÉTENCES');
    expect(xml).toContain('LANGUES');
  });

  // The PDF renders **bold**: the Word document must not print the asterisks
  it('prints the summary, intro, bullets and KPI without their markdown markers', async () => {
    const gamma = mockCV.experience[3];
    const xml = await toXml({
      ...mockCV,
      personal_info: { ...mockCV.personal_info, summary: 'Profil **produit**' },
      experience: [{ ...gamma, intro: 'Intro *gamma*', description: ['Puce `Figma`', 'B', 'C', 'D'], kpi: '**+30 %**' }],
    });
    expect(xml).toContain('Profil produit');
    expect(xml).toContain('Intro gamma');
    expect(xml).toContain('Puce Figma');
    expect(xml).toContain('+30 %');
    expect(xml).not.toContain('*');
  });

  it('prints the portfolio as a clickable label, like the PDF header', async () => {
    const buffer = await Packer.toBuffer(buildCvDocument({
      ...mockCV,
      personal_info: {
        ...mockCV.personal_info,
        portfolio_url: 'https://example.com/portfolio/ia',
        portfolio_label: 'Portfolio IA Product',
      },
    }));
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    const rels = await zip.file('word/_rels/document.xml.rels')!.async('string');
    expect(xml).toMatch(/<w:hyperlink[^>]*>[\s\S]*Portfolio IA Product[\s\S]*<\/w:hyperlink>/);
    expect(rels).toContain('https://example.com/portfolio/ia');
    expect(xml).toContain('linkedin.com/in/jean');
  });

  it('formats education like the templates: localized date, field, no orphan separator', async () => {
    const xml = await toXml({
      ...mockCV,
      education: [
        { school: 'Gobelins', degree: 'Master Design', field: 'UX/UI', start_date: '2012', end_date: '2015-06' },
        { school: 'Lycée', degree: 'Bac', start_date: '2008' },
      ],
    });
    expect(xml).toContain('Master Design, UX/UI');
    expect(xml).toContain('(Juin 2015)');
    expect(xml).not.toContain('()');
  });

  it('prints skill categories with their display name, not the dictionary key', async () => {
    const xml = await toXml({ ...mockCV, skills: [{ category: 'technical', items: ['React'] }] });
    expect(xml).toContain('Compétences techniques: ');
    expect(xml).not.toContain('technical: ');
  });

  it('leaves out the sections switched off in the Design tab', async () => {
    const buffer = await Packer.toBuffer(buildCvDocument(mockCV, 'fr', ['personal', 'experience', 'education', 'languages']));
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).not.toContain('COMPÉTENCES');
    expect(xml).not.toContain('PROFIL PROFESSIONNEL');
    expect(xml).toContain('FORMATION');
  });

  it('uses localized dates and current label', async () => {
    const xml = await toXml(mockCV);
    expect(xml).toContain('Janv. 2020 - Présent');
    expect(xml).toContain('Mars 2018 - Déc. 2019');
  });

  it('mirrors displayMode rendering: intro always, bullets per mode', async () => {
    const xml = await toXml(mockCV);
    // normal: intro (description[0]) + 2 action bullets, not the 3rd
    expect(xml).toContain('Intro alpha line');
    expect(xml).toContain('Bullet alpha A');
    expect(xml).toContain('Bullet alpha B');
    expect(xml).not.toContain('Bullet alpha C');
    // compact: intro only
    expect(xml).toContain('Intro beta line');
    expect(xml).not.toContain('Bullet beta A');
    // hidden: fully absent
    expect(xml).not.toContain('HiddenCorp');
    // extended with dedicated intro: intro + up to 4 description bullets
    expect(xml).toContain('Dedicated gamma intro');
    expect(xml).toContain('Bullet gamma D');
  });

  it('shows KPI only when shouldShowKPI (extended by default)', async () => {
    const xml = await toXml(mockCV);
    expect(xml).toContain('Team of 12');
    expect(xml).not.toContain('KPI alpha metric');
  });

  it('respects skill display modes', async () => {
    const xml = await toXml(mockCV);
    expect(xml).toContain('s1, s2, s3');
    expect(xml).not.toContain('s4');
    expect(xml).not.toContain('SecretSkills');
    expect(xml).toContain('Jira, Figma');
  });

  it('normalizes language proficiency in FR', async () => {
    const xml = await toXml(mockCV);
    expect(xml).toContain('Courant (C1)');
  });
});

describe('buildCvDocument (en)', () => {
  it('uses EN section titles, dates and proficiency', async () => {
    const xml = await toXml(mockCV, 'en');
    expect(xml).toContain('WORK EXPERIENCE');
    expect(xml).toContain('PROFESSIONAL SUMMARY');
    expect(xml).toContain('EDUCATION');
    expect(xml).toContain('SKILLS');
    expect(xml).toContain('LANGUAGES');
    expect(xml).toContain('Jan. 2020 - Present');
    expect(xml).toContain('Fluent (C1)');
    expect(xml).not.toContain('Présent');
  });
});
