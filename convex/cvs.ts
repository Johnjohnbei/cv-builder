import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listMyCVs = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    return await ctx.db
      .query("cvs")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});

export const createMyCV = mutation({
  args: {
    personal_info: v.any(),
    experience: v.array(v.any()),
    education: v.array(v.any()),
    skills: v.array(v.any()),
    languages: v.array(v.any()),
    design: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    return await ctx.db.insert("cvs", {
      ...args,
      userId: identity.subject,
      createdAt: new Date().toISOString(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("cvs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    const cv = await ctx.db.get(args.id);
    if (!cv || cv.userId !== identity.subject) {
      throw new Error("Not authorized to delete this CV");
    }
    await ctx.db.delete(args.id);
  },
});

export const getById = query({
  args: { id: v.id("cvs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const cv = await ctx.db.get(args.id);
    if (!cv || cv.userId !== identity.subject) return null;
    return cv;
  },
});
