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

  it('finishes a wave before starting the next: no role drops two rungs ahead', () => {
    let cur = expandToMax([strong, mid, weak]);
    for (let i = 0; i < 9; i++) {
      const next = condenseOneStep(cur, REQUIREMENTS);
      if (!next) break;
      cur = next;
      const rungs = modes(cur).map(m => ['extended', 'normal', 'compact', 'hidden'].indexOf(m));
      expect(Math.max(...rungs) - Math.min(...rungs)).toBeLessThanOrEqual(1);
    }
  });

  it('never hides anything while some experience still has bullets', () => {
    let cur = expandToMax([strong, mid, weak]);
    for (let i = 0; i < 12; i++) {
      const next = condenseOneStep(cur, REQUIREMENTS);
      if (!next) break;
      cur = next;
      if (modes(cur).includes('hidden')) {
        expect(modes(cur).every(m => m === 'compact' || m === 'hidden')).toBe(true);
      }
    }
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

  it('protects nothing for a requirement the offer only prefers', () => {
    const preferred = [req('figma'), { ...kubernetes, importance: 'preferred' as const }];
    expect(modes(condenseOneStep(expandToMax([rich, carrier]), preferred)!)).toEqual(['extended', 'normal']);
  });

  it('protects the mention only while it is written: once dropped, the wave goes on as before', () => {
    const wave = expandToMax([rich, carrier]);
    const once = condenseOneStep(wave, requirements)!;
    // rich came down first; the next step has no reason left to spare the carrier
    expect(modes(condenseOneStep(once, requirements)!)).toEqual(['normal', 'normal']);
  });
});
