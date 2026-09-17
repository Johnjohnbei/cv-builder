import { describe, it, expect } from 'vitest';
import type { ContentBlock } from './types';
import { carryOver } from './reconcile';

const block = (id: string, heightPx: number, data: unknown): ContentBlock =>
  ({ id, type: 'experience', heightPx, splittable: false, data }) as ContentBlock;

describe('carryOver', () => {
  const roleA = { position: 'A' };
  const roleB = { position: 'B' };
  const measured = [block('exp-0', 300, roleA), block('exp-1', 200, roleB)];

  // Measured on a 20-role CV (2026-09-17): the fit counted three pages for one
  // on screen and hid roles down to a single page
  it('starts over when the estimates changed, even with a block whose data changed', () => {
    const condensed = { ...roleA, displayMode: 'compact' };
    expect(carryOver(measured, true, [block('exp-0', 120, condensed)])).toEqual({ blocks: null, remeasure: true });
  });

  it('puts the new data on the measured heights when the estimates did not change', () => {
    const edited = { ...roleB, position: 'B2' };
    const { blocks, remeasure } = carryOver(measured, false, [block('exp-0', 999, roleA), block('exp-1', 999, edited)]);
    expect(remeasure).toBe(true);
    expect(blocks!.map(b => [b.heightPx, b.data])).toEqual([[300, roleA], [200, edited]]);
  });

  it('keeps the measured blocks as they are when no data changed', () => {
    expect(carryOver(measured, false, [block('exp-0', 1, roleA), block('exp-1', 1, roleB)])).toEqual({ blocks: measured, remeasure: false });
  });

  it('has nothing to carry before the first measure', () => {
    expect(carryOver(null, false, measured)).toEqual({ blocks: null, remeasure: false });
  });
});
