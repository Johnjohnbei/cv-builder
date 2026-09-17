import { describe, it, expect } from 'vitest';
import { expandToMax, condenseOneStep, maxCondenseSteps } from './fitToPages';
import type { Experience, ExperienceDisplayMode, JobRequirement } from '@/src/shared/types';

const req = (label: string): JobRequirement => ({
  id: label, label, variants: [], kind: 'hard_skill', importance: 'required', quote: label,
});
const REQUIREMENTS = [req('figma'), req('design system'), req('saas'), req('design ops')];

function makeExp(over: Partial<Experience> = {}): Experience {
  return {
    company: 'Acme',
    position: 'Designer',
    start_date: '2020-01',
    end_date: '2022-01',
    current: false,
    description: ['a', 'b', 'c', 'd'],
    ...over,
  };
}

/** Highly relevant + current → top of the score band */
const strong = makeExp({
  position: 'Lead Design System Figma',
  company: 'SaaS Corp',
  start_date: '2018-01',
  current: true,
  description: ['Design system Figma', 'SaaS design', 'design ops', 'figma tokens'],
});

/** No requirement match, old, short → bottom of the score band */
const weak = makeExp({
  position: 'Stagiaire',
  company: 'Vieille Boite',
  start_date: '2005-01',
  end_date: '2005-06',
  description: ['courses', 'photocopies'],
});

const mid = makeExp({ position: 'Designer produit', start_date: '2015-01', end_date: '2017-01' });

/** Run the loop the way useFitToPages does, but with a fake page measurement. */
function condenseUntil(
  experiences: Experience[],
  fits: (exps: Experience[]) => boolean,
): { result: Experience[]; steps: number } {
  let cur = expandToMax(experiences);
  let steps = 0;
  while (!fits(cur) && steps <= maxCondenseSteps(experiences)) {
    const next = condenseOneStep(cur, REQUIREMENTS);
    if (!next) break;
    cur = next;
    steps++;
  }
  return { result: cur, steps };
}

const modes = (exps: Experience[]) => exps.map(e => e.displayMode as ExperienceDisplayMode);

describe('expandToMax', () => {
  it('puts every experience at the richest mode', () => {
    expect(modes(expandToMax([strong, weak]))).toEqual(['extended', 'extended']);
  });

  it('does not mutate its input', () => {
    const input = [makeExp({ displayMode: 'compact' })];
    expandToMax(input);
    expect(input[0].displayMode).toBe('compact');
  });
});

describe('condenseOneStep', () => {
  it('condenses the weakest experience first', () => {
    const start = expandToMax([strong, weak]);
    expect(modes(condenseOneStep(start, REQUIREMENTS)!)).toEqual(['extended', 'normal']);
  });

  it('moves exactly one experience by exactly one rung', () => {
    const start = expandToMax([strong, weak, mid]);
    const next = condenseOneStep(start, REQUIREMENTS)!;
    expect(next.filter((e, i) => e.displayMode !== start[i].displayMode)).toHaveLength(1);
  });

  /** Every state the loop goes through, from full detail down to nothing */
  const walk = (exps: Experience[], requirements = REQUIREMENTS) => {
    const states: ExperienceDisplayMode[][] = [];
    let cur: Experience[] | null = expandToMax(exps);
    while (cur) {
      states.push(modes(cur));
      cur = condenseOneStep(cur, requirements);
    }
    return states;
  };

  // A CV where every role was equally thin read as a list (arbitrage of 2026-09-17)
  it('keeps the most relevant third detailed while the others come down to compact', () => {
    const states = walk([weak, strong, mid]);
    const firstTouch = states.find(([, top]) => top !== 'extended')!;
    expect(firstTouch).toEqual(['compact', 'normal', 'compact']);
  });

  it('hides a less relevant role only once the most relevant one is down to normal', () => {
    const firstHidden = walk([weak, strong, mid]).find(state => state.includes('hidden'))!;
    expect(firstHidden[1]).toBe('normal');
    expect(firstHidden.filter(m => m === 'hidden')).toHaveLength(1);
  });

  it('never hides the role held today before the most relevant ones', () => {
    const today = { ...weak, current: true, end_date: undefined };
    const firstHidden = walk([today, strong, mid, makeExp({ position: 'Assistant', start_date: '2008-01', end_date: '2009-01' })])
      .find(state => state.includes('hidden'))!;
    expect(firstHidden[0]).not.toBe('hidden');
    expect(firstHidden[3]).toBe('hidden');
  });

  it('does not highlight a role whose dates could not be read', () => {
    const undated = { ...weak, current: true, start_date: '', end_date: undefined };
    // Three strong roles fill the relevant third: only a "current" flag could highlight it
    const firstHidden = walk([undated, strong, { ...strong }, { ...strong }, mid, mid])
      .find(state => state.includes('hidden'))!;
    // Highlighted, it would still be at normal when the first role is hidden
    expect(['compact', 'hidden']).toContain(firstHidden[0]);
  });

  it('takes the older of two equal roles down first, within a stage', () => {
    const [, second] = walk([strong, weak, { ...weak }]);
    expect(second).toEqual(['extended', 'extended', 'normal']);
  });

  it('takes the most relevant role down last', () => {
    const states = walk([weak, strong, mid]);
    const lastVisible = states.find(state => state.filter(m => m !== 'hidden').length === 1)!;
    expect(lastVisible[1]).not.toBe('hidden');
  });

  it('hides the weakest experience before the strongest', () => {
    let cur = expandToMax([strong, weak]);
    for (let i = 0; i < 12; i++) {
      const next = condenseOneStep(cur, REQUIREMENTS);
      if (!next) break;
      cur = next;
      if (modes(cur).includes('hidden')) break;
    }
    expect(cur[1].displayMode).toBe('hidden');
    expect(cur[0].displayMode).not.toBe('hidden');
  });

  it('returns null once everything is hidden', () => {
    const allHidden = [strong, weak].map(e => ({ ...e, displayMode: 'hidden' as const }));
    expect(condenseOneStep(allHidden, REQUIREMENTS)).toBeNull();
  });

  it('works without a job description (no requirements)', () => {
    expect(condenseOneStep(expandToMax([strong, weak]), [])).not.toBeNull();
  });
});

describe('the driving loop', () => {
  it('stops at the richest state that fits', () => {
    const exps = [strong, mid, weak];
    // Fake budget: fits once at most one experience is still 'extended'
    const { result } = condenseUntil(exps, cur => modes(cur).filter(m => m === 'extended').length <= 1);
    expect(modes(result)).toEqual(['extended', 'normal', 'normal']);
  });

  it('does nothing when the CV already fits at full detail', () => {
    const { result, steps } = condenseUntil([strong, weak], () => true);
    expect(steps).toBe(0);
    expect(modes(result)).toEqual(['extended', 'extended']);
  });

  it('terminates within maxCondenseSteps even if nothing ever fits', () => {
    const exps = [strong, mid, weak, makeExp({ current: true })];
    const { steps } = condenseUntil(exps, () => false);
    expect(steps).toBeLessThanOrEqual(maxCondenseSteps(exps));
  });
});

describe('condenseOneStep: the last mention of a required requirement', () => {
  const kubernetes = req('kubernetes');
  const requirements = [req('figma'), kubernetes];

  /** The weakest of the two, and the only one writing Kubernetes — in a bullet 'normal' drops */
  const carrier = makeExp({
    position: 'Stagiaire',
    company: 'Vieille Boite',
    start_date: '2005-01',
    end_date: '2005-06',
    description: ['Courses', 'Photocopies', 'Classement', 'Migration Kubernetes'],
  });
  /** Scores high: Figma, current, a matching title */
  const rich = makeExp({
    position: 'Lead Design System Figma',
    company: 'SaaS Corp',
    start_date: '2018-01',
    current: true,
    description: ['Design system Figma', 'SaaS design', 'figma tokens', 'design ops'],
  });

  it('condenses a stronger experience of the wave rather than dropping it', () => {
    const wave = expandToMax([rich, carrier]);
    // On the score alone the weakest goes first, and Kubernetes leaves the CV
    expect(modes(condenseOneStep(wave, requirements)!)).toEqual(['normal', 'extended']);
  });

  it('keeps taking the lowest score when no candidate writes it alone', () => {
    const twice = expandToMax([{ ...rich, description: [...rich.description.slice(0, 3), 'Migration Kubernetes'] }, carrier]);
    expect(modes(condenseOneStep(twice, requirements)!)).toEqual(['extended', 'normal']);
  });

  it('condenses it anyway when it is the only candidate of the wave', () => {
    expect(modes(condenseOneStep(expandToMax([carrier]), requirements)!)).toEqual(['normal']);
  });

  it('protects nothing for a requirement the rest of the CV writes too', () => {
    // Condensing an experience never takes a skill or the summary away
    const elsewhere = new Set(['kubernetes']);
    expect(modes(condenseOneStep(expandToMax([rich, carrier]), requirements, 'fr', elsewhere)!)).toEqual(['extended', 'normal']);
  });

  it('protects nothing for a kind the score never reads in an experience', () => {
    // A title is counted from the positions, a degree from the education
    const title = [req('figma'), { ...kubernetes, kind: 'title' as const }];
    expect(modes(condenseOneStep(expandToMax([rich, carrier]), title)!)).toEqual(['extended', 'normal']);
  });

  it('protects nothing for a requirement the offer only prefers', () => {
    const preferred = [req('figma'), { ...kubernetes, importance: 'preferred' as const }];
    expect(modes(condenseOneStep(expandToMax([rich, carrier]), preferred)!)).toEqual(['extended', 'normal']);
  });

  it('gives the mention up once every other move would drop a required one too', () => {
    let cur = expandToMax([rich, carrier]);
    for (let step = 0; step < 3; step++) cur = condenseOneStep(cur, requirements)!;
    // rich came down while it could without losing Figma; hidden it would lose it
    expect(modes(cur)).toEqual(['compact', 'normal']);
  });
});
