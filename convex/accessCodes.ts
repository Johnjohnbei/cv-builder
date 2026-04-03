import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Verify an access code (called from AI actions) ───
export const verify = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("accessCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
    
    if (!record) return { valid: false, reason: "Code inconnu" };
    if (new Date(record.expiresAt) < new Date()) return { valid: false, reason: "Code expiré" };
    if (record.usedCount >= record.maxUses) return { valid: false, reason: "Code épuisé" };
    
    return { valid: true };
  },
});

// ─── Increment usage count when code is used ───
export const incrementUsage = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("accessCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
    if (record) {
      await ctx.db.patch(record._id, { usedCount: record.usedCount + 1 });
    }
  },
});

// ─── Generate a new access code (admin use) ───
export const generate = mutation({
  args: {
    code: v.optional(v.string()),
    maxUses: v.number(),
    durationDays: v.number(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const code = args.code || Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + args.durationDays * 24 * 60 * 60 * 1000).toISOString();
    
    await ctx.db.insert("accessCodes", {
      code,
      maxUses: args.maxUses,
      usedCount: 0,
      expiresAt,
      createdAt: new Date().toISOString(),
      label: args.label,
    });
    
    return { code, expiresAt, maxUses: args.maxUses };
  },
});

// ─── List all codes (admin use) ───
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("accessCodes").collect();
  },
});

// ─── Submit an access request ───
export const requestAccess = mutation({
  args: {
    email: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("accessRequests", {
      email: args.email,
      message: args.message,
      createdAt: new Date().toISOString(),
    });
    return { success: true };
  },
});

// ─── List access requests (admin use) ───
export const listRequests = query({
  handler: async (ctx) => {
    return await ctx.db.query("accessRequests").order("desc").collect();
  },
});
