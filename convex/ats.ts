import { internalMutation, internalQuery, query } from './_generated/server';
import { v } from 'convex/values';
import { ATS_POLICY, ATS_SOURCES } from '../src/features/editor/lib/ats-rules';
import { internal } from './_generated/api';

/** Private extracted requirements/quotes, not complete offers. Expired workers cannot overwrite a new lease. */
export const acquire = internalMutation({
  args: { key: v.string(), token: v.string() },
  handler: async (ctx, { key, token }) => {
    const now = Date.now();
    const entry = await ctx.db.query('atsAnalyses').withIndex('by_key', q => q.eq('key', key)).unique();
    if (entry && entry.expiresAt > now) return entry.requirements ? { state: 'ready' as const, requirements: entry.requirements } : { state: 'busy' as const };
    const lease = { key, token, expiresAt: now + 130_000 };
    if (entry) await ctx.db.replace(entry._id, lease);
    else await ctx.db.insert('atsAnalyses', lease);
    return { state: 'acquired' as const };
  },
});

export const finish = internalMutation({
  args: { key: v.string(), token: v.string(), requirements: v.optional(v.array(v.any())) },
  handler: async (ctx, { key, token, requirements }) => {
    const entry = await ctx.db.query('atsAnalyses').withIndex('by_key', q => q.eq('key', key)).unique();
    if (!entry || entry.token !== token || entry.expiresAt <= Date.now()) return;
    if (!requirements?.length) { await ctx.db.delete(entry._id); return; }
    await ctx.db.patch(entry._id, { requirements, expiresAt: Date.now() + ATS_POLICY.cacheMaxAgeMs });
  },
});

export const cleanExpired = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const expired = await ctx.db.query('atsAnalyses').withIndex('by_expiry', q => q.lt('expiresAt', Date.now())).take(200);
    await Promise.all(expired.map(entry => ctx.db.delete(entry._id)));
    if (expired.length === 200) await ctx.scheduler.runAfter(0, internal.ats.cleanExpired, {});
  },
});

export const recordSource = internalMutation({
  args: { sourceId: v.string(), hash: v.optional(v.string()), text: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!ATS_SOURCES.some(source => source.id === args.sourceId)) throw new Error('Unknown source');
    const entry = await ctx.db.query('atsSources').withIndex('by_source', q => q.eq('sourceId', args.sourceId)).unique();
    const checkedAt = Date.now();
    const changed = Boolean(args.hash && entry?.hash && args.hash !== entry.hash);
    if (args.text && args.text.length > 100_000) throw new Error('Source too large');
    const update = { checkedAt, error: args.error, ...(args.hash && { hash: args.hash, text: args.text }), ...(changed && { changedAt: checkedAt }) };
    if (entry) await ctx.db.patch(entry._id, update);
    else await ctx.db.insert('atsSources', { sourceId: args.sourceId, ...update });
  },
});

/** Operator-only CLI action after reading the diff and running the corpus; never public. */
export const acceptSource = internalMutation({
  args: { sourceId: v.string(), hash: v.string(), rulesVersion: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db.query('atsSources').withIndex('by_source', q => q.eq('sourceId', args.sourceId)).unique();
    if (!entry || entry.error || entry.hash !== args.hash || args.rulesVersion !== ATS_POLICY.version) throw new Error('Source or release changed; review again');
    await ctx.db.patch(entry._id, { reviewedHash: args.hash, reviewedText: entry.text });
  },
});

export const sourceReview = internalQuery({
  args: { sourceId: v.string() },
  handler: async (ctx, { sourceId }) => ctx.db.query('atsSources').withIndex('by_source', q => q.eq('sourceId', sourceId)).unique(),
});

/** Only public documentation state; no cached offers, identities or CVs. */
export const sourceStatus = query({
  args: {},
  handler: async ctx => Promise.all(ATS_SOURCES.map(async source => {
    const entry = await ctx.db.query('atsSources').withIndex('by_source', q => q.eq('sourceId', source.id)).unique();
    return { ...source, checkedAt: entry?.checkedAt ?? null, hash: entry?.hash ?? null,
      status: entry?.error ? 'error' : !entry?.hash ? 'not_checked' : entry.hash !== entry.reviewedHash ? 'review_required' : 'reviewed',
    };
  })),
});
