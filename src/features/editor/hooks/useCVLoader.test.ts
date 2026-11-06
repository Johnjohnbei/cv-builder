import { describe, expect, it } from 'vitest';
import { cvSourceOf } from './useCVLoader';

describe('cvSourceOf', () => {
  it('waits for the account query instead of reading the guest copy', () => {
    // The bug: a signed-in tab still carrying a guest flag opened the guest CV,
    // and the auto-save then wrote it into this account's own draft
    expect(cvSourceOf(true, false, true)).toBe('wait');
    expect(cvSourceOf(true, false, false)).toBe('wait');
  });

  it('reads the account only, once it has answered, guest flag or not', () => {
    expect(cvSourceOf(true, true, true)).toBe('account');
    expect(cvSourceOf(true, true, false)).toBe('account');
  });

  it('reads the guest copy only without an account', () => {
    expect(cvSourceOf(false, false, true)).toBe('guest');
  });

  it('has nothing to read for a visitor with neither', () => {
    expect(cvSourceOf(false, false, false)).toBe('none');
  });
});
