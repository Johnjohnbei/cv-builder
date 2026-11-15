import { describe, it, expect } from 'vitest';
import { forApplication, save, get, applications, list } from '../coverLetters';
const handler = (fn: unknown) => (fn as { _handler: (ctx: any, args: any) => Promise<any> })._handler;
function context() {
  const rows: any[] = [];
  let actor: string | null = 'alice';
  const db = {
    query: () => ({ withIndex: (_name: string, select: (q: any) => any) => {
      const predicates: ((row: any) => boolean)[] = [];
      const index = { eq: (key: string, value: any) => { predicates.push(row => row[key] === value); return index; } };
      select(index);
      const result = {
        first: async () => rows.find(row => predicates.every(test => test(row))) ?? null,
        order: () => result,
        paginate: async () => ({ page: rows.filter(row => predicates.every(test => test(row))), isDone: true, continueCursor: '' }),
        take: async (n: number) => rows.filter(row => predicates.every(test => test(row))).slice(0, n),
        filter: (predicate: (q: any) => (row: any) => boolean) => {
          const q = { field: (key: string) => key, eq: (key: string, value: any) => (row: any) => row[key] === value };
          predicates.push(predicate(q)); return result;
        },
      };
      return result;
    } }),
    get: async (id: string) => rows.find(row => row._id === id) ?? null,
    insert: async (_table: string, data: any) => { const _id = `letter-${rows.length}`; rows.push({ ...data, _id }); return _id; },
    patch: async (id: string, data: any) => { Object.assign(rows.find(row => row._id === id), data); },
  };
  return { rows, db, auth: { getUserIdentity: async () => actor ? { subject: actor } : null }, actor: (name: string | null) => { actor = name; } };
}
const LETTER = { jobDescription: 'Offer one', subject: 'Designer', greeting: 'Bonjour', body: 'Mon parcours.', closing: 'Merci' };
describe('application letters', () => {
  it('upserts the same trimmed offer and isolates offers and accounts', async () => {
    const ctx = context();
    const first = await handler(save)(ctx, LETTER);
    await handler(save)(ctx, { ...LETTER, jobDescription: ' Offer one ', body: 'Texte modifié' });
    expect(ctx.rows).toHaveLength(1);
    expect((await handler(forApplication)(ctx, { jobDescription: 'Offer one' })).body).toBe('Texte modifié');
    await handler(save)(ctx, { ...LETTER, jobDescription: 'Offer two' });
    ctx.actor('bob');
    expect(await handler(forApplication)(ctx, { jobDescription: 'Offer one' })).toBeNull();
    await expect(handler(get)(ctx, { id: first })).rejects.toThrow();
    await handler(save)(ctx, LETTER);
    expect(ctx.rows).toHaveLength(3);
  });
  it('reads and promotes an old record without duplicating or removing it', async () => {
    const ctx = context();
    ctx.rows.push({ ...LETTER, userId: 'alice', _id: 'old', createdAt: '2026-01-01' });
    expect((await handler(forApplication)(ctx, { jobDescription: 'Offer one' }))._id).toBe('old');
    expect(await handler(save)(ctx, LETTER)).toBe('old');
    expect(ctx.rows[0].offerFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(ctx.rows).toHaveLength(1);
  });
  it('rejects another user’s CV and oversized inputs', async () => {
    const ctx = context();
    ctx.rows.push({ _id: 'cv-bob', userId: 'bob' });
    await expect(handler(save)(ctx, { ...LETTER, cvId: 'cv-bob' })).rejects.toThrow();
    await expect(handler(save)(ctx, { ...LETTER, body: 'x'.repeat(6001) })).rejects.toThrow();
    ctx.actor(null);
    await expect(handler(save)(ctx, LETTER)).rejects.toThrow();
    expect(await handler(forApplication)(ctx, { jobDescription: 'Offer one' })).toBeNull();
  });
  it('lists only metadata, leaving document and CV snapshots out of subscriptions', async () => {
    const ctx = context();
    await handler(save)(ctx, { ...LETTER, cvSnapshot: { personal_info: { name: 'Alex' } } });
    const { page: [entry] } = await handler(applications)(ctx, { paginationOpts: { numItems: 20, cursor: null } });
    expect(entry.subject).toBe('Designer');
    expect(entry).not.toHaveProperty('body');
    expect(entry).not.toHaveProperty('cvSnapshot');
    expect(await handler(list)(ctx, {})).toHaveLength(1);
  });
});
