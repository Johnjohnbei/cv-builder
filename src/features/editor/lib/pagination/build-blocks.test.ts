import { describe, it, expect } from 'vitest';
import type { CVData, Experience } from '@/src/shared/types';
import { buildBlocks } from './build-blocks';

const exp = (over: Partial<Experience> = {}): Experience => ({
  company: 'Acme', position: 'Product Designer', start_date: '2020-01', end_date: '2023-01', current: false,
  intro: 'Équipe paiement.',
  description: ['Conçu les maquettes', 'Mené les tests', 'Livré le design system'],
  displayMode: 'extended',
  ...over,
});

const cv = (over: Partial<CVData> = {}): CVData => ({
  personal_info: { name: 'Alex', email: 'a@b.c', title: 'Designer', summary: 'Designer produit.' },
  experience: [exp()],
  education: [{ school: 'ENSCI', degree: 'Master', start_date: '2014', end_date: '2016' }],
  skills: [{ category: 'tools', items: ['Figma', 'Sketch'] }],
  languages: [{ name: 'Anglais', proficiency: 'C1' }],
  ...over,
});

const ids = (data: CVData, sections?: string[]) => buildBlocks(data, sections).map(b => b.id);

// This is where the sub-blocks splitBlock does its arithmetic on are decided
describe('buildBlocks', () => {
  it('builds one block per part of the CV, experiences and skill categories apart', () => {
    expect(ids(cv())).toEqual(['header', 'summary', 'exp-0', 'skill-0', 'education', 'languages']);
  });

  it('leaves out the sections the Design tab switched off', () => {
    expect(ids(cv(), ['experience'])).toEqual(['header', 'exp-0']);
  });

  it('gives an experience its header, one sub-block per visible bullet, and the KPI when it shows', () => {
    const [block] = buildBlocks(cv({ experience: [exp({ kpi: '+12 %', showKpi: true })] })).filter(b => b.type === 'experience');
    expect(block.subBlocks?.map(s => s.type)).toEqual(['exp-header', 'bullet', 'bullet', 'bullet', 'kpi']);
    expect(block.splittable).toBe(true);
  });

  it('counts the visible bullets only, and makes a role of fewer than two unsplittable', () => {
    const [normal] = buildBlocks(cv({ experience: [exp({ displayMode: 'normal' })] })).filter(b => b.type === 'experience');
    expect(normal.subBlocks?.filter(s => s.type === 'bullet')).toHaveLength(2);
    const [compact] = buildBlocks(cv({ experience: [exp({ displayMode: 'compact' })] })).filter(b => b.type === 'experience');
    expect(compact.splittable).toBe(false);
  });

  it('keeps the role of a hidden experience for the ones that follow', () => {
    const data = cv({ experience: [exp({ displayMode: 'hidden' }), exp({ company: 'Beta' })] });
    const [block] = buildBlocks(data).filter(b => b.type === 'experience');
    // Its id counts the VISIBLE roles, its sourceIndex its place in the CV
    expect(block.id).toBe('exp-0');
    expect(block.sourceIndex).toBe(1);
  });

  it('leaves out an empty skill category, an entry with nothing written and a missing section', () => {
    const data = cv({
      skills: [{ category: 'tools', items: [] }, { category: 'method', items: ['Scrum'] }],
      education: [{ school: '', degree: '  ', start_date: '', end_date: '' }],
      languages: [{ name: '', proficiency: 'C1' }],
      personal_info: { name: 'Alex', email: 'a@b.c' },
    });
    expect(ids(data)).toEqual(['header', 'exp-0', 'skill-0']);
  });

  it('estimates a height for every block, so the first paint paginates before any measure', () => {
    expect(buildBlocks(cv()).every(b => b.heightPx > 0)).toBe(true);
  });
});
