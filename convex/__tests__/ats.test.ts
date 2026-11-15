import { afterEach, describe, expect, it, vi } from 'vitest';
import { acquire, finish, recordSource, acceptSource, cleanExpired } from '../ats';
import { ATS_POLICY } from '../../src/features/editor/lib/ats-rules';

/** In-memory DB seam: test the lease decisions, not Convex's transaction engine. */
function database() {
  const rows: any[] = [];
  const db = {
    query: (table: string) => ({ withIndex: (_name: string, select: (q: any) => any) => {
      const tests: ((row: any) => boolean)[] = [];
      const q = { eq: (key: string, value: any) => { tests.push(row => row[key] === value); return q; }, lt: (key: string, value: number) => { tests.push(row => row[key] < value); return q; } };
      select(q);
      const matching = () => rows.filter(row => row.table === table && tests.every(test => test(row)));
      return { unique: async () => matching()[0] ?? null, take: async (n: number) => matching().slice(0, n) };
    } }),
    insert: async (table: string, value: any) => { const _id = String(rows.length + 1); rows.push({ ...value, table, _id }); return _id; },
    replace: async (id: string, value: any) => { const row = rows.find(row => row._id === id); for (const key of Object.keys(row)) if (!['_id', 'table'].includes(key)) delete row[key]; Object.assign(row, value); },
    patch: async (id: string, value: any) => { Object.assign(rows.find(row => row._id === id), value); },
    delete: async (id: string) => { rows.splice(rows.findIndex(row => row._id === id), 1); },
  };
  return { db, rows, scheduler: { runAfter: vi.fn() } };
}
const handler = (fn: unknown) => (fn as { _handler: (ctx: any, args: any) => Promise<any> })._handler;
afterEach(() => vi.useRealTimers());

describe('private distributed offer cache', () => {
  it('grants one lease, shares its result, and keeps different identities separate', async () => {
    const ctx = database();
    expect(await handler(acquire)(ctx, { key: 'account-a-offer', token: 'one' })).toEqual({ state: 'acquired' });
    expect(await handler(acquire)(ctx, { key: 'account-a-offer', token: 'two' })).toEqual({ state: 'busy' });
    await handler(finish)(ctx, { key: 'account-a-offer', token: 'one', requirements: [{ label: 'Figma' }] });
    expect(await handler(acquire)(ctx, { key: 'account-a-offer', token: 'three' })).toEqual({ state: 'ready', requirements: [{ label: 'Figma' }] });
    expect(await handler(acquire)(ctx, { key: 'account-b-offer', token: 'four' })).toEqual({ state: 'acquired' });
  });
  it('does not let a timed-out worker overwrite the replacement worker', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const ctx = database();
    await handler(acquire)(ctx, { key: 'a', token: 'old' });
    vi.setSystemTime(131_000);
    await handler(acquire)(ctx, { key: 'a', token: 'new' });
    await handler(finish)(ctx, { key: 'a', token: 'old', requirements: ['obsolete'] });
    expect(await handler(acquire)(ctx, { key: 'a', token: 'next' })).toEqual({ state: 'busy' });
    await handler(finish)(ctx, { key: 'a', token: 'new', requirements: ['current'] });
    expect(await handler(acquire)(ctx, { key: 'a', token: 'next' })).toEqual({ state: 'ready', requirements: ['current'] });
  });
  it('releases failures and purges expired private cache records', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const ctx = database();
    await handler(acquire)(ctx, { key: 'a', token: 'one' });
    await handler(finish)(ctx, { key: 'a', token: 'one' });
    expect(ctx.rows).toEqual([]);
    await handler(acquire)(ctx, { key: 'a', token: 'two' });
    vi.setSystemTime(131_000);
    await handler(cleanExpired)(ctx, {});
    expect(ctx.rows).toEqual([]);
  });
});

describe('official sources are reviewed before adoption', () => {
  it('keeps the reviewed snapshot when the source changes or becomes inaccessible', async () => {
    const ctx = database(); const sourceId = 'greenhouse-parsing';
    await handler(recordSource)(ctx, { sourceId, hash: 'first', text: 'Original' });
    await handler(acceptSource)(ctx, { sourceId, hash: 'first', rulesVersion: ATS_POLICY.version });
    await handler(recordSource)(ctx, { sourceId, hash: 'second', text: 'Changed' });
    await handler(recordSource)(ctx, { sourceId, error: 'Unavailable' });
    expect(ctx.rows[0]).toMatchObject({ reviewedHash: 'first', reviewedText: 'Original', hash: 'second', text: 'Changed', error: 'Unavailable' });
    await expect(handler(acceptSource)(ctx, { sourceId, hash: 'first', rulesVersion: ATS_POLICY.version })).rejects.toThrow();
    await expect(handler(acceptSource)(ctx, { sourceId, hash: 'second', rulesVersion: 'old' })).rejects.toThrow();
  });
});
