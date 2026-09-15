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

  it('a section switched off in Design reads as empty; the header with the title is always printed', () => {
    const sections = cvSections(cv(), 'rendered', { includedSections: ['experience'] });
    expect(sections.skills).toEqual([]);
    expect(sections.summary).toEqual([]);
    expect(sections.title).toEqual(['Product Designer']);
  });

  it('reads the skill category titles and company tags as the templates print them', () => {
    const printed = cv({
      skills: [{ category: 'technical', items: ['React'] }],
      experience: [exp({ companyStage: 'Scaleup', companyBusinessModel: 'SaaS', displayMode: 'normal' })],
    });
    const { skills, experience } = cvSections(printed, 'rendered');
    expect(skills).toEqual(['Compétences techniques', 'React']);
    expect(experience).toContain('SaaS');
    expect(experience).toContain('Scaleup');
  });

  // The templates render **design** as bold "design": the score must read the same words
  it('reads inline markdown as the words the templates print', () => {
    const bold = cv({ experience: [exp({ description: ['Construit le **design** system'], kpi: '*+30 %* de conversion', displayMode: 'extended' })] });
    expect(cvSections(bold, 'rendered').experience).toContain('Construit le design system');
    expect(cvSections(bold, 'rendered').experience).toContain('+30 % de conversion');
    expect(found(computeATSReport(bold, [req('design system', { kind: 'hard_skill' })]))).toEqual(['design system']);
  });

  // The templates render markdown in the summary, intros, bullets and KPI only; the rest prints as typed
  it('removes markdown once, and only where the templates render it', () => {
    const typed = cv({
      personal_info: { name: 'A', email: 'a@b.fr', title: '*Lead* designer', summary: '**a*b**' },
      skills: [{ category: 'Outils', items: ['*C*'] }],
    });
    const sections = cvSections(typed, 'rendered');
    expect(sections.title).toEqual(['*Lead* designer']);
    expect(sections.skills).toEqual(['Outils', '*C*']);
    // renderInlineMarkdown prints "*" + <em>a</em> + "b**"
    expect(sections.summary).toEqual(['*ab**']);
  });

  it('skips a skill category with no visible item, which the templates do not print', () => {
    const empty = cv({ skills: [{ category: 'Figma', items: [] }, { category: 'Outils', items: ['Sketch'] }] });
    expect(cvSections(empty, 'rendered').skills).toEqual(['Outils', 'Sketch']);
    expect(cvSections(empty, 'content').skills).toEqual(['Outils', 'Sketch']);
  });
});

describe('yearsOfExperience', () => {
  const NOW = new Date('2022-01-15');

  // Both months count: "January 2015 to December 2019" is five years on a CV
  it('counts the start and end months, as a CV reads', () => {
    expect(yearsOfExperience([exp({ start_date: '2015-01', end_date: '2019-12' })], NOW)).toBe(5);
    expect(yearsOfExperience([exp({ start_date: 'Décembre 2015', end_date: 'Janvier 2016' })], NOW)).toBeCloseTo(2 / 12, 5);
  });

  it('reads the "Mois YYYY" dates the import writes', () => {
    expect(yearsOfExperience([exp({ start_date: 'Septembre 2016', end_date: 'Mars 2019' })], NOW)).toBeCloseTo(31 / 12, 5);
  });

  it('merges overlapping roles and counts a current role until this month', () => {
    const years = yearsOfExperience([
      exp({ start_date: '2015-01', end_date: '2018-01' }),
      exp({ start_date: '2017-01', end_date: '2019-01' }),
      exp({ start_date: '2020-01', end_date: '', current: true }),
    ], NOW);
    expect(years).toBeCloseTo((49 + 25) / 12, 5);
  });

  // "2019 - 2021" may be anything from a few months to three years: its middle
  // is two years, never the three that would claim a requirement it may miss
  it('reads a bare year at its middle', () => {
    expect(yearsOfExperience([exp({ start_date: '2019', end_date: '2021' })], NOW)).toBe(2);
    expect(yearsOfExperience([exp({ start_date: '2019', end_date: '2019' })], NOW)).toBeCloseTo(1 / 12, 5);
  });

  // The editor's date field is free text
  it.each([
    ['fevrier 2019', 'aout 2021'],
    ['Févr. 2019', 'Août 2021'],
    ['2019-02-15', '2021-08-31'],
    ['15/02/2019', '31/08/2021'],
  ])('reads the typed dates %s to %s', (start_date, end_date) => {
    expect(yearsOfExperience([exp({ start_date, end_date })], NOW)).toBeCloseTo(31 / 12, 5);
  });

  it('ignores a role without a start date, with an unreadable date, or ending before it starts', () => {
    expect(yearsOfExperience([
      exp({ start_date: '' }),
      exp({ start_date: '2019-00', end_date: '2020-01' }),
      exp({ start_date: '2021-06', end_date: '2020-01' }),
      exp({ start_date: '2020-03', end_date: '2020-01' }),
    ], NOW)).toBe(0);
  });

  // Pasted from macOS or a PDF, "é" can arrive as "e" and a combining accent
  it('reads a date whose accent is decomposed', () => {
    const decomposed = 'Févr. 2019'.normalize('NFD');
    expect(yearsOfExperience([exp({ start_date: decomposed, end_date: 'Août 2021'.normalize('NFD') })], NOW)).toBeCloseTo(31 / 12, 5);
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
    // The panel shows the points the score is made of, so it can be recounted
    expect(report.requirements.map(r => r.weight)).toEqual([3, 3, 1, 1]);
    expect(report.points).toEqual({ covered: 6, total: 8 });
  });

  // The plan's guard: the old score gave a well-matched CV 35 and a weak one 59
  it('scores the CV that proves the offer above a CV that only shares its common words', () => {
    const requirements = [
      req('Product Designer', { kind: 'title' }), req('Figma'), req('design system', { kind: 'hard_skill' }),
      req('recherche utilisateur', { kind: 'method' }), req('SaaS', { kind: 'domain', importance: 'preferred' }),
    ];
    const relevant = cv({ experience: [exp({ description: ['Construit le design system Figma du SaaS', 'Mené la recherche utilisateur'] })] });
    const weak = cv({
      personal_info: { name: 'B', email: 'b@b.fr', title: 'Responsable administratif' },
      experience: [exp({ position: 'Assistant', description: ["Travail en équipe dans l'entreprise", 'Gestion de projets'] })],
      skills: [{ category: 'Outils', items: ['Word'] }],
    });
    expect(computeATSReport(relevant, requirements).score).toBeGreaterThanOrEqual(90);
    expect(computeATSReport(weak, requirements).score).toBeLessThan(20);
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
    // Shown in the panel, so the verdict can be checked against the dates
    expect(report.requirements.map(r => r.years)).toEqual([37 / 12, 37 / 12]);
  });

  it('does not count a requirement placed only in a hidden experience, unless the content view is asked', () => {
    const hidden = cv({ experience: [exp(), exp({ description: ['Pilotage Kubernetes'], displayMode: 'hidden' })] });
    expect(found(computeATSReport(hidden, [req('Kubernetes')]))).toEqual([]);
    expect(found(computeATSReport(hidden, [req('Kubernetes')], { view: 'content' }))).toEqual(['Kubernetes']);
  });

  it('fails the checks a parser needs: contact, job titles written out, readable dates', () => {
    const failing = computeATSReport(cv({
      personal_info: { name: 'A', email: 'pas-un-email', phone: '12 34', location: '' },
      experience: [exp({ position: 'Sr. Designer', start_date: 'depuis longtemps' })],
    }), []);
    expect(Object.fromEntries(failing.checks.map(c => [c.id, c.passed])))
      .toEqual({ email: false, phone: false, location: false, titles: false, dates: false });
  });

  // Years are measured from the dates: an unreadable one silently lowered them
  it('checks the dates of the printed roles only, a current role needing no end', () => {
    const datesPassed = (experience: Experience[]) => computeATSReport(cv({ experience }), []).checks.find(c => c.id === 'dates')?.passed;
    expect(datesPassed([exp({ start_date: '2020-01', end_date: '', current: true })])).toBe(true);
    expect(datesPassed([exp({ end_date: 'bientôt' })])).toBe(false);
    expect(datesPassed([exp(), exp({ start_date: '', displayMode: 'hidden' })])).toBe(true);
  });

  it.each(['Dév. front', 'Resp. marketing', 'Mgr produit'])('flags the abbreviated title %s', (position) => {
    const report = computeATSReport(cv({ experience: [exp({ position })] }), []);
    expect(report.checks.find(c => c.id === 'titles')?.passed).toBe(false);
  });

  it('does not crash on an empty CV', () => {
    const report = computeATSReport(EMPTY_CV, [req('Figma')]);
    expect(report.score).toBe(0);
  });
});
