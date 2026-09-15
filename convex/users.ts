import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { unauthenticated, userNotFound } from "./_shared/errors";

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
  },
});

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticated();

    const existing = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();

    const now = new Date().toISOString();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: identity.email || existing.email,
        fullName: identity.name || existing.fullName,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("users", {
        userId: identity.subject,
        email: identity.email || "",
        fullName: identity.name || "",
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const updateLastGeneratedCV = mutation({
  args: {
    cvData: v.any(),
    jobDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticated();

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();

    if (!user) throw userNotFound();

    await ctx.db.patch(user._id, {
      lastGeneratedCV: args.cvData,
      // Omitted means "leave the stored offer alone", not "erase it": a patch
      // with undefined deletes the field, so "Enregistrer" used to wipe the
      // offer the draft was tailored to. Callers pass "" to clear it.
      ...(args.jobDescription !== undefined && { lastJobDescription: args.jobDescription }),
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * The CV the user imported, kept apart from the working draft it seeds. Nothing
 * wrote this field before: the dashboard read it, the import wrote the draft
 * instead, so a signed-in user lost the import on reload and the import
 * overwrote the draft being edited.
 */
export const saveBaseCV = mutation({
  args: { cvData: v.any() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticated();

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();

    if (!user) throw userNotFound();

    await ctx.db.patch(user._id, {
      baseCV: args.cvData,
      updatedAt: new Date().toISOString(),
    });
  },
});
