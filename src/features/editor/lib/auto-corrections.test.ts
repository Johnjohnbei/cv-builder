import { describe, it, expect } from 'vitest';
import type { CVData } from '@/src/shared/types';
import { autoCorrect, expandAbbreviations, mergeSkillCategories } from './auto-corrections';
import { computeATSReport } from './keyword-analysis';

const cv = (over: Partial<CVData> = {}): CVData => ({
  personal_info: { name: 'Alex', email: 'a@b.c', title: 'Designer' },
  experience: [{ company: 'Acme', position: 'Designer', start_date: '2020', current: true, description: [] }],
  education: [], languages: [], skills: [],
  ...over,
});

describe('expandAbbreviations', () => {
  it('writes out the abbreviations a title parser misses, accents included', () => {
    expect(expandAbbreviations('Sr. Designer', 'fr')).toBe('Senior Designer');
    expect(expandAbbreviations('Resp. marketing', 'fr')).toBe('Responsable marketing');
    expect(expandAbbreviations('Dév. front', 'fr')).toBe('Développeur front');
    expect(expandAbbreviations('Mgr produit', 'fr')).toBe('Manager produit');
    expect(expandAbbreviations('Sr. Designer', 'en')).toBe('Senior Designer');
  });

  it('leaves a word that merely starts with an abbreviation, and Dev without its full stop', () => {
    expect(expandAbbreviations('Directeur artistique', 'fr')).toBe('Directeur artistique');
    expect(expandAbbreviations('Dev Ops', 'fr')).toBe('Dev Ops');
    expect(expandAbbreviations('Développeur back', 'fr')).toBe('Développeur back');
  });

  it('keeps the spacing of the title it was given', () => {
    expect(expandAbbreviations('Sr.   Designer produit', 'fr')).toBe('Senior   Designer produit');
  });
});

describe('mergeSkillCategories', () => {
  it('merges the categories sharing a key and drops the duplicate items', () => {
    expect(mergeSkillCategories([
      { category: 'other', items: ['Scrum', 'Jira'] },
      { category: 'tools', items: ['Figma'] },
      { category: 'other', items: ['Jira', 'Notion'] },
    ])).toEqual([
      { category: 'other', items: ['Scrum', 'Jira', 'Notion'] },
      { category: 'tools', items: ['Figma'] },
    ]);
  });

  it('leaves distinct categories alone', () => {
    const skills = [{ category: 'tools', items: ['Figma'] }, { category: 'method', items: ['Scrum'] }];
    expect(mergeSkillCategories(skills)).toEqual(skills);
  });
});

describe('autoCorrect', () => {
  it('returns the very same CV when there is nothing to correct', () => {
    const source = cv();
    expect(autoCorrect(source, 'fr').cv).toBe(source);
    expect(autoCorrect(source, 'fr').corrections).toEqual([]);
  });

  it('writes out the titles of the header and of every experience, and says how many', () => {
    const { cv: fixed, corrections } = autoCorrect(cv({
      personal_info: { name: 'Alex', email: 'a@b.c', title: 'Sr. Product Designer' },
      experience: [
        { company: 'Acme', position: 'Resp. design', start_date: '2020', current: true, description: [] },
        { company: 'Beta', position: 'Designer', start_date: '2018', current: false, description: [] },
      ],
    }), 'fr');
    expect(fixed.personal_info.title).toBe('Senior Product Designer');
    expect(fixed.experience.map(e => e.position)).toEqual(['Responsable design', 'Designer']);
    expect(corrections).toEqual(['2 intitulés abrégés écrits en entier']);
  });

  // The correction exists to make that check pass without the user doing a thing
  it('makes the `titles` check of the ATS report pass', () => {
    const source = cv({ personal_info: { name: 'Alex', email: 'a@b.c', title: 'Sr. Designer' } });
    const check = (data: CVData) => computeATSReport(data, [], { view: 'content' }).checks.find(c => c.id === 'titles');
    expect(check(source)?.passed).toBe(false);
    expect(check(autoCorrect(source, 'fr').cv)?.passed).toBe(true);
  });

  it('counts the merged categories and the duplicate skills apart', () => {
    const { corrections } = autoCorrect(cv({
      skills: [{ category: 'other', items: ['Scrum', 'Jira'] }, { category: 'other', items: ['Jira'] }],
    }), 'fr');
    expect(corrections).toEqual(['1 catégorie de compétences en double fusionnée', '1 compétence en double retirée']);
  });
});
