import { describe, it, expect } from 'vitest';
import type { CVData, Experience, JobRequirement } from '@/src/shared/types';
import { EMPTY_CV } from '@/src/shared/types';
import { computeATSReport, cvSections, yearsOfExperience } from './keywordAnalysis';

// ─── Fixtures ───

const exp = (over: Partial<Experience> = {}): Experience => ({
  company: 'Acme',
  position: 'Product Designer',
  start_date: '2020-01',
  current: false,
  end_date: '2023-01',
  description: ['Conçu les maquettes Figma', 'Mené 30 entretiens utilisateurs', 'Animé les ateliers'],
  ...over,
});

const cv = (over: Partial<CVData> = {}): CVData => ({
  personal_info: {
    name: 'Alex Martin', email: 'alex@example.com', phone: '+33 6 12 34 56 78', location: 'Paris',
    title: 'Product Designer', summary: 'Designer produit en SaaS B2B.',
  },
  experience: [exp()],
  education: [{ school: 'ENSCI', degree: 'Master design', start_date: '2014', end_date: '2016' }],
  skills: [{ category: 'Outils', items: ['Figma', 'Sketch'] }],
  languages: [{ name: 'Anglais', proficiency: 'C1' }],
  ...over,
});

const req = (label: string, over: Partial<JobRequirement> = {}): JobRequirement => ({
  id: label.toLowerCase(), label, variants: [], kind: 'tool', importance: 'required', quote: label, ...over,
});

const found = (report: ReturnType<typeof computeATSReport>) =>
  report.requirements.filter(r => r.found).map(r => r.requirement.label);

// ─── What a recruiter's ATS reads ───

describe('cvSections', () => {
  const triaged = cv({
    experience: [
      exp({ position: 'Lead', intro: 'Rôle de lead', kpi: 'Équipe de 8', description: ['Puce A', 'Puce B', 'Puce C'], displayMode: 'normal' }),
      exp({ position: 'Masquée', displayMode: 'hidden' }),
      exp({ position: 'Compacte', intro: 'Intro compacte', displayMode: 'compact' }),
      exp({ position: 'Étendue', kpi: 'KPI étendu', displayMode: 'extended' }),
    ],
    skills: [
      { category: 'Outils', items: ['Figma', 'Sketch', 'Framer', 'Miro'], displayMode: 'compact' },
      { category: 'Cachées', items: ['Cobol'], displayMode: 'hidden' },
    ],
  });

  it('rendered view follows the display modes, like the templates', () => {
    const { experience, skills } = cvSections(triaged, 'rendered');
    expect(experience).not.toContain('Masquée');
    expect(experience).toContain('Rôle de lead');
    // normal: intro and two bullets, no KPI
    expect(experience).toContain('Puce B');
    expect(experience).not.toContain('Puce C');
    expect(experience).not.toContain('Équipe de 8');
    // compact: intro only
    expect(experience).toContain('Intro compacte');
    // extended without intro: the first bullet stands as intro, three more follow
    expect(experience.filter(t => t === 'Conçu les maquettes Figma')).toHaveLength(1);
    expect(experience).toContain('Animé les ateliers');
    // extended: KPI shown
    expect(experience).toContain('KPI étendu');
    expect(skills).toEqual(['Outils', 'Figma', 'Sketch', 'Framer']);
  });

  it('content view keeps every experience, bullet, KPI and skill', () => {
    const { experience, skills } = cvSections(triaged, 'content');
    expect(experience).toContain('Masquée');
    expect(experience).toContain('Animé les ateliers');
    expect(experience).toContain('Équipe de 8');
    expect(skills).toContain('Miro');
    expect(skills).toContain('Cobol');
  });

  it('a section switched off in Design reads as empty', () => {
    const sections = cvSections(cv(), 'rendered', { includedSections: ['personal', 'experience'] });
    expect(sections.skills).toEqual([]);
    expect(sections.summary).toEqual([]);
    expect(sections.title).toEqual(['Product Designer']);
  });
});

describe('yearsOfExperience', () => {
  const NOW = new Date('2022-01-15');

  it('merges overlapping roles and counts a current role until now', () => {
    const years = yearsOfExperience([
      exp({ start_date: '2015-01', end_date: '2018-01' }),
      exp({ start_date: '2017-01', end_date: '2019-01' }),
      exp({ start_date: '2020-01', end_date: '', current: true }),
    ], NOW);
    expect(years).toBeCloseTo(6, 1);
  });

  it('reads a bare year and ignores a role without a start date', () => {
    expect(yearsOfExperience([exp({ start_date: '2019', end_date: '2021' }), exp({ start_date: '' })], NOW)).toBeCloseTo(2, 1);
  });
});

// ─── The score ───

describe('computeATSReport', () => {
  it('gives no score without requirements, and still runs the readability checks', () => {
    const report = computeATSReport(cv(), []);
    expect(report.score).toBeNull();
    expect(report.requirements).toEqual([]);
    expect(report.checks.every(c => c.passed)).toBe(true);
  });

  it('weights required 3, preferred 1, a title 3 and a soft skill 1, whatever their importance', () => {
    const report = computeATSReport(cv(), [
      req('Product Designer', { kind: 'title', importance: 'preferred' }),
      req('Figma'),
      req('Design Thinking', { kind: 'method', importance: 'preferred' }),
      req('Leadership', { kind: 'soft_skill' }),
    ]);
    // found: title 3 + Figma 3 ; total: 3 + 3 + 1 + 1
    expect(report.score).toBe(75);
  });

  it('matches a variant, accents and plurals, and tells where', () => {
    const report = computeATSReport(cv(), [
      req('User research', { variants: ['entretien utilisateur'] }),
      req('Système de design', { variants: ['design system'] }),
    ]);
    expect(found(report)).toEqual(['User research']);
    expect(report.requirements[0].sections).toEqual(['experience']);
  });

  it('finds a job title in the profile title or a position, never in a bullet', () => {
    const inBullet = cv({ personal_info: { name: 'A', email: 'a@b.fr' }, experience: [exp({ position: 'Designer', description: ['Travaillé avec le Head of Design'] })] });
    expect(found(computeATSReport(inBullet, [req('Head of Design', { kind: 'title' })]))).toEqual([]);
    expect(found(computeATSReport(cv(), [req('Product Designer', { kind: 'title' })]))).toEqual(['Product Designer']);
  });

  it('reads a degree in education and a language in languages only', () => {
    const summaryOnly = cv({ languages: [], personal_info: { name: 'A', email: 'a@b.fr', summary: 'Anglais courant' } });
    expect(found(computeATSReport(cv(), [req('Master', { kind: 'education' }), req('Anglais', { kind: 'language' })])))
      .toEqual(['Master', 'Anglais']);
    expect(found(computeATSReport(summaryOnly, [req('Anglais', { kind: 'language' })]))).toEqual([]);
  });

  it('measures years of experience from the dates', () => {
    const years = (minYears: number) => req(`${minYears} ans`, { kind: 'experience_years', minYears });
    const report = computeATSReport(cv(), [years(3), years(4)], { now: new Date('2024-01-01') });
    expect(found(report)).toEqual(['3 ans']);
  });

  it('does not count a requirement placed only in a hidden experience, unless the content view is asked', () => {
    const hidden = cv({ experience: [exp(), exp({ description: ['Pilotage Kubernetes'], displayMode: 'hidden' })] });
    expect(found(computeATSReport(hidden, [req('Kubernetes')]))).toEqual([]);
    expect(found(computeATSReport(hidden, [req('Kubernetes')], { view: 'content' }))).toEqual(['Kubernetes']);
  });

  it('fails the checks a parser needs: contact, and job titles written out', () => {
    const failing = computeATSReport(cv({
      personal_info: { name: 'A', email: 'pas-un-email', phone: '12 34', location: '' },
      experience: [exp({ position: 'Sr. Designer' })],
    }), []);
    expect(Object.fromEntries(failing.checks.map(c => [c.id, c.passed])))
      .toEqual({ email: false, phone: false, location: false, titles: false });
  });

  it('fails the contact checks when the header is switched off', () => {
    const report = computeATSReport(cv(), [], { design: { includedSections: ['experience'] } });
    expect(report.checks.filter(c => !c.passed).map(c => c.id)).toEqual(['email', 'phone', 'location']);
  });

  it('does not crash on an empty CV', () => {
    const report = computeATSReport(EMPTY_CV, [req('Figma')]);
    expect(report.score).toBe(0);
  });
});
