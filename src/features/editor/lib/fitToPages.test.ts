import { describe, it, expect } from 'vitest';
import { expandToMax, condenseOneStep, maxCondenseSteps } from './fitToPages';
import type { Experience, ExperienceDisplayMode } from '@/src/shared/types';

const KEYWORDS = ['figma', 'design', 'system', 'saas'];

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

/** No keyword match, old, short → bottom of the score band */
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
    const next = condenseOneStep(cur, KEYWORDS);
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
    expect(modes(condenseOneStep(start, KEYWORDS)!)).toEqual(['extended', 'normal']);
  });

  it('moves exactly one experience by exactly one rung', () => {
    const start = expandToMax([strong, weak, mid]);
    const next = condenseOneStep(start, KEYWORDS)!;
    expect(next.filter((e, i) => e.displayMode !== start[i].displayMode)).toHaveLength(1);
  });

  it('finishes a wave before starting the next: no role drops two rungs ahead', () => {
    let cur = expandToMax([strong, mid, weak]);
    for (let i = 0; i < 9; i++) {
      const next = condenseOneStep(cur, KEYWORDS);
      if (!next) break;
      cur = next;
      const rungs = modes(cur).map(m => ['extended', 'normal', 'compact', 'hidden'].indexOf(m));
      expect(Math.max(...rungs) - Math.min(...rungs)).toBeLessThanOrEqual(1);
    }
  });

  it('never hides anything while some experience still has bullets', () => {
    let cur = expandToMax([strong, mid, weak]);
    for (let i = 0; i < 12; i++) {
      const next = condenseOneStep(cur, KEYWORDS);
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
      const next = condenseOneStep(cur, KEYWORDS);
      if (!next) break;
      cur = next;
      if (modes(cur).includes('hidden')) break;
    }
    expect(cur[1].displayMode).toBe('hidden');
    expect(cur[0].displayMode).not.toBe('hidden');
  });

  it('returns null once everything is hidden', () => {
    const allHidden = [strong, weak].map(e => ({ ...e, displayMode: 'hidden' as const }));
    expect(condenseOneStep(allHidden, KEYWORDS)).toBeNull();
  });

  it('works without a job description (no keywords)', () => {
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
