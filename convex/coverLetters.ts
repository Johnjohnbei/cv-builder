import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("coverLetters")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});

export const save = mutation({
  args: {
    cvId: v.optional(v.id("cvs")),
    jobDescription: v.string(),
    companyName: v.optional(v.string()),
    subject: v.string(),
    greeting: v.string(),
    body: v.string(),
    closing: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    return await ctx.db.insert("coverLetters", {
      ...args,
      userId: identity.subject,
      createdAt: new Date().toISOString(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("coverLetters") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const letter = await ctx.db.get(args.id);
    if (!letter || letter.userId !== identity.subject) {
      throw new Error("Not authorized");
    }
    await ctx.db.delete(args.id);
  },
});
