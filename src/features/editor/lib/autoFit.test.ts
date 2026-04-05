import { describe, it, expect } from 'vitest';
import { condenseOneStep } from './autoFit';
import type { Experience, SkillCategory } from '@/src/shared/types';

function makeExp(mode: string = 'normal', priority: number = 50): Experience {
  return {
    company: 'Co',
    position: 'Dev',
    start_date: '2020',
    current: false,
    description: ['Did things'],
    displayMode: mode as any,
  };
}

function makeSkill(mode: string = 'normal'): SkillCategory {
  return { category: 'Tech', items: ['React', 'TS'], displayMode: mode as any };
}

describe('condenseOneStep', () => {
  it('condenses lowest-priority experience first', () => {
    const exps = [makeExp('extended'), makeExp('normal'), makeExp('normal')];
    const skills = [makeSkill()];
    const priorities = [90, 50, 30]; // idx 2 is lowest

    const result = condenseOneStep(exps, skills, priorities);
    expect(result).not.toBeNull();
    // Lowest priority (idx 2) should be condensed from normal → compact
    expect(result!.experiences[2].displayMode).toBe('compact');
    // Others unchanged
    expect(result!.experiences[0].displayMode).toBe('extended');
    expect(result!.experiences[1].displayMode).toBe('normal');
  });

  it('never hides the last visible experience', () => {
    const exps = [makeExp('compact')]; // only one, already compact
    const skills: SkillCategory[] = [];
    const priorities = [10];

    const result = condenseOneStep(exps, skills, priorities);
    // Should return null — can't hide the last one
    expect(result).toBeNull();
  });

  it('condenses skills when they outnumber condensable experiences', () => {
    const exps = [makeExp('compact')]; // can't condense further without hiding
    const skills = [makeSkill('normal'), makeSkill('normal')];
    const priorities = [50];

    const result = condenseOneStep(exps, skills, priorities);
    expect(result).not.toBeNull();
    // A skill should have been condensed
    const compactSkills = result!.skills.filter(s => s.displayMode === 'compact');
    expect(compactSkills.length).toBe(1);
  });

  it('returns null when nothing can be condensed', () => {
    const exps = [makeExp('hidden')];
    const skills = [makeSkill('hidden')];
    const priorities = [50];

    expect(condenseOneStep(exps, skills, priorities)).toBeNull();
  });

  it('does not mutate input arrays', () => {
    const exps = [makeExp('extended'), makeExp('normal')];
    const skills = [makeSkill()];
    const priorities = [80, 20];

    const origExps = JSON.stringify(exps);
    const origSkills = JSON.stringify(skills);

    condenseOneStep(exps, skills, priorities);

    expect(JSON.stringify(exps)).toBe(origExps);
    expect(JSON.stringify(skills)).toBe(origSkills);
  });

  it('never hides the last visible skill category', () => {
    const exps: Experience[] = [];
    const skills = [makeSkill('compact')]; // only one, already compact
    const priorities: number[] = [];

    const result = condenseOneStep(exps, skills, priorities);
    // Can't hide the last visible skill
    expect(result).toBeNull();
  });

  it('steps through extended → normal → compact → hidden for lowest priority', () => {
    const exps = [makeExp('extended'), makeExp('extended')];
    const skills: SkillCategory[] = [];
    const priorities = [90, 20]; // idx 1 gets condensed first

    let state = { experiences: exps, skills };
    const modes: string[] = [];

    for (let i = 0; i < 10; i++) {
      const result = condenseOneStep(state.experiences, state.skills, priorities);
      if (!result) break;
      state = result;
      modes.push(state.experiences[1].displayMode!);
    }

    // idx 1 should go through: normal → compact → hidden, then idx 0 gets condensed
    expect(modes[0]).toBe('normal');
    expect(modes[1]).toBe('compact');
    expect(modes[2]).toBe('hidden');
  });
});
