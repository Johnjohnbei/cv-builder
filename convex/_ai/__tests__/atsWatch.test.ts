import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkSources } from '../atsWatch';
import { ATS_SOURCES } from '../../../src/features/editor/lib/ats-rules';

const run = (ctx: any) => (checkSources as unknown as { _handler: (ctx: any, args: {}) => Promise<void> })._handler(ctx, {});
afterEach(() => vi.unstubAllGlobals());

describe('ATS documentation monitor', () => {
  it('only fetches the registered URLs without redirects and records bounded readable snapshots', async () => {
    const text = 'Official documentation of resume parsing. '.repeat(20);
    const fetch = vi.fn(async () => new Response(`<article><h1>Parsing</h1>${text}</article><script>random()</script>`));
    vi.stubGlobal('fetch', fetch);
    const ctx = { runMutation: vi.fn(async () => undefined) };
    await run(ctx);
    expect(fetch.mock.calls.map(call => (call as unknown[])[0])).toEqual(ATS_SOURCES.map(source => source.url));
    for (const call of fetch.mock.calls as unknown as [string, RequestInit][]) expect(call[1].redirect).toBe('error');
    for (const [, args] of ctx.runMutation.mock.calls as unknown as [unknown, any][]) {
      expect(args.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(args.text).toContain('Official documentation');
      expect(args.text).not.toContain('random()');
    }
  });
  it('records an error instead of replacing a snapshot with a blocked page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Access denied')));
    const ctx = { runMutation: vi.fn(async () => undefined) };
    await run(ctx);
    for (const [, args] of ctx.runMutation.mock.calls as unknown as [unknown, any][]) {
      expect(args.error).toBeTruthy();
      expect(args.hash).toBeUndefined();
    }
  });
});
