import { describe, it, expect } from 'vitest';
import { ConvexError } from 'convex/values';
import { getErrorCode, getUserErrorMessage } from './convexError';

const FALLBACK = 'Une erreur est survenue';

describe('getUserErrorMessage', () => {
  it('returns userMessage from a ConvexError', () => {
    const e = new ConvexError({ userMessage: 'Les services IA sont momentanément indisponibles. Réessayez dans une minute.', code: 'AI_UNAVAILABLE' });
    expect(getUserErrorMessage(e, FALLBACK)).toContain('momentanément indisponibles');
  });

  it('falls back when ConvexError data has no userMessage', () => {
    expect(getUserErrorMessage(new ConvexError({ code: 'X' }), FALLBACK)).toBe(FALLBACK);
    expect(getUserErrorMessage(new ConvexError('raw string data'), FALLBACK)).toBe(FALLBACK);
    expect(getUserErrorMessage(new ConvexError({ userMessage: '' }), FALLBACK)).toBe(FALLBACK);
  });

  it('falls back for plain Errors and non-errors', () => {
    expect(getUserErrorMessage(new Error('Server Error'), FALLBACK)).toBe(FALLBACK);
    expect(getUserErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(getUserErrorMessage('boom', FALLBACK)).toBe(FALLBACK);
  });
});

describe('getErrorCode', () => {
  it('returns the stable code of a ConvexError', () => {
    expect(getErrorCode(new ConvexError({ userMessage: 'Code expiré', code: 'ACCESS_CODE_INVALID' }))).toBe('ACCESS_CODE_INVALID');
  });

  it('returns undefined when there is no code to read', () => {
    expect(getErrorCode(new ConvexError({ userMessage: 'x' }))).toBeUndefined();
    expect(getErrorCode(new Error('ACCESS_CODE_INVALID'))).toBeUndefined();
    expect(getErrorCode(null)).toBeUndefined();
  });
});
