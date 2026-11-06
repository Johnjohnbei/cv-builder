import { describe, it, expect } from 'vitest';
import { isAllowedOrigin, isRateLimited, validatePayload } from './generate-pdf';

const request = (headers: Record<string, string>) => new Request('https://calibre.app/api/generate-pdf', { headers });

// The endpoint renders arbitrary HTML in a browser on the server: these three
// are what keeps it the app's own, and none of them was tested
describe('isAllowedOrigin', () => {
  it('accepts a same-origin call and nothing else', () => {
    expect(isAllowedOrigin(request({ origin: 'https://calibre.app', host: 'calibre.app' }))).toBe(true);
    expect(isAllowedOrigin(request({ origin: 'https://evil.example', host: 'calibre.app' }))).toBe(false);
  });

  it('refuses a call with no origin, no host, or an unreadable origin', () => {
    expect(isAllowedOrigin(request({ host: 'calibre.app' }))).toBe(false);
    expect(isAllowedOrigin(request({ origin: 'https://calibre.app' }))).toBe(false);
    expect(isAllowedOrigin(request({ origin: 'pas une url', host: 'calibre.app' }))).toBe(false);
  });

  it('reads the host, not the scheme or the path', () => {
    expect(isAllowedOrigin(request({ origin: 'http://localhost:3000', host: 'localhost:3000' }))).toBe(true);
    expect(isAllowedOrigin(request({ origin: 'https://calibre.app.evil.example', host: 'calibre.app' }))).toBe(false);
  });
});

describe('isRateLimited', () => {
  it('lets ten calls a minute through and stops the eleventh', () => {
    const ip = `test-${Math.random()}`;
    for (let call = 0; call < 10; call++) expect(isRateLimited(ip)).toBe(false);
    expect(isRateLimited(ip)).toBe(true);
  });

  it('counts each address on its own', () => {
    const busy = `busy-${Math.random()}`;
    for (let call = 0; call < 11; call++) isRateLimited(busy);
    expect(isRateLimited(`quiet-${Math.random()}`)).toBe(false);
  });
});

describe('validatePayload', () => {
  it('accepts an html and styles pair, and only that', () => {
    expect(validatePayload({ html: '<p>a</p>', styles: 'p{}' })).toEqual({ valid: true, data: { html: '<p>a</p>', styles: 'p{}' } });
  });

  it('refuses anything else, without saying what the server expects beyond the shape', () => {
    for (const body of [null, 'texte', 42, {}, { html: '<p>a</p>' }, { styles: 'p{}' }, { html: '', styles: 'p{}' }, { html: '<p>a</p>', styles: '' }, { html: 1, styles: 'p{}' }]) {
      expect(validatePayload(body).valid, JSON.stringify(body)).toBe(false);
    }
  });
});
