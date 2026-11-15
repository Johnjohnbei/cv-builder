import { paginationOptsValidator } from 'convex/server';
import { mutation, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { notAuthorized, unauthenticated, userError } from "./_shared/errors";
import { assertBoundedPrompt, assertMaxLength, cvArgument, MAX_OFFER_CHARS } from "./_ai/inputLimits";
import type { Id } from "./_generated/dataModel";

const applicationArgs = { cvId: v.optional(v.id("cvs")), jobDescription: v.string() };
async function fingerprint(offer: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(offer.trim()));
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}
async function application(ctx: QueryCtx, userId: string, cvId: Id<'cvs'> | undefined, jobDescription: string) {
  const hash = await fingerprint(jobDescription);
  const current = await ctx.db.query('coverLetters').withIndex('by_application', q =>
    q.eq('userId', userId).eq('cvId', cvId).eq('offerFingerprint', hash)).first();
  if (current) return current;
  // Compatibility for records predating the fingerprint. First save promotes it in place.
  return ctx.db.query('coverLetters').withIndex('by_application', q =>
    q.eq('userId', userId).eq('cvId', cvId).eq('offerFingerprint', undefined))
    .filter(q => q.eq(q.field('jobDescription'), jobDescription)).first();
}
export const forApplication = query({
  args: applicationArgs,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    assertMaxLength(args.jobDescription, MAX_OFFER_CHARS);
    return application(ctx, identity.subject, args.cvId, args.jobDescription);
  },
});
export const applications = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: '' };
    const records = await ctx.db.query('coverLetters').withIndex('by_recent', q => q.eq('userId', identity.subject)).order('desc').paginate(paginationOpts);
    return { ...records, page: records.page.map(({ _id, companyName, subject, createdAt, cvId }) => ({ _id, companyName, subject, createdAt, cvId })) };
  },
});
/** Release compatibility: already-open clients still query the original list contract. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return ctx.db.query('coverLetters').withIndex('by_userId', q => q.eq('userId', identity.subject)).order('desc').take(50);
  },
});
export const get = query({
  args: { id: v.id('coverLetters') },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticated();
    const letter = await ctx.db.get(id);
    if (!letter || letter.userId !== identity.subject) throw notAuthorized();
    return letter;
  },
});
export const save = mutation({
  args: { ...applicationArgs, companyName: v.optional(v.string()), companyStage: v.optional(v.string()),
    companyBusinessModel: v.optional(v.string()), motivation: v.optional(v.string()), tone: v.optional(v.string()),
    cvSnapshot: v.optional(v.any()), revisions: v.optional(v.array(v.object({ subject: v.string(), greeting: v.string(), body: v.string(), closing: v.string() }))), subject: v.string(), greeting: v.string(), body: v.string(), closing: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticated();
    assertMaxLength(args.jobDescription, MAX_OFFER_CHARS);
    for (const text of [args.subject, args.greeting, args.body, args.closing, args.motivation ?? '']) assertMaxLength(text, 6000);
    for (const text of [args.companyName, args.companyStage, args.companyBusinessModel, args.tone]) assertMaxLength(text ?? '', 200);
    if (args.revisions && args.revisions.length > 20) throw userError('Trop de versions de lettre.', 'INPUT_TOO_LONG');
    for (const revision of args.revisions ?? []) for (const text of Object.values(revision)) assertMaxLength(text, 6000);
    if (args.cvSnapshot) { assertBoundedPrompt(cvArgument(args.cvSnapshot).cv); assertMaxLength(JSON.stringify(args.cvSnapshot), 500000); }
    if (args.cvId) {
      const cv = await ctx.db.get(args.cvId);
      if (!cv || cv.userId !== identity.subject) throw notAuthorized();
    }
    const existing = await application(ctx, identity.subject, args.cvId, args.jobDescription);
    const data = { ...args, offerFingerprint: await fingerprint(args.jobDescription), createdAt: new Date().toISOString() };
    if (existing) { await ctx.db.patch(existing._id, data); return existing._id; }
    return ctx.db.insert('coverLetters', { ...data, userId: identity.subject });
  },
});
export const remove = mutation({
  args: { id: v.id("coverLetters") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticated();
    const record = await ctx.db.get(id);
    if (!record || record.userId !== identity.subject) throw notAuthorized();
    await ctx.db.delete(id);
  },
});
