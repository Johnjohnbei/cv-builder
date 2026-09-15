import { mutation, query, internalMutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { userError } from "./_shared/errors";

const ADMIN_EMAIL = "joaudran@gmail.com";

function findCode(db: QueryCtx["db"], code: string) {
  return db
    .query("accessCodes")
    .withIndex("by_code", (q) => q.eq("code", code.trim()))
    .first();
}

/** Why a code cannot be used, or null when it can. */
function rejectionReason(record: Doc<"accessCodes"> | null): string | null {
  if (!record) return "Code inconnu";
  if (new Date(record.expiresAt) < new Date()) return "Code expiré";
  if (record.usedCount >= record.maxUses) return "Code épuisé";
  return null;
}

// ─── Check a code before storing it (access modal) ───
export const verify = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const reason = rejectionReason(await findCode(ctx.db, args.code));
    return reason ? { valid: false, reason } : { valid: true };
  },
});

// ─── Check and count one use, atomically (called from AI actions) ───
// A separate check then increment ran in two transactions, so concurrent calls
// could all pass the check and push a code past maxUses. The public, unauthenticated
// incrementUsage mutation that let anyone exhaust any code is gone.
export const consumeInternal = internalMutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const record = await findCode(ctx.db, args.code);
    const reason = rejectionReason(record);
    if (reason || !record) return { valid: false, reason: reason ?? "Code inconnu" };
    await ctx.db.patch(record._id, { usedCount: record.usedCount + 1 });
    return { valid: true, reason: "" };
  },
});

/**
 * 10 characters from an alphabet without look-alikes (0/O, 1/I), from a
 * cryptographic source. The former Math.random 6-character codes could be
 * guessed through the public verify query.
 */
function randomCode(length = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (b) => alphabet[b % alphabet.length]).join("");
}

// ─── Generate a new access code (admin only) ───
export const generate = mutation({
  args: {
    code: v.optional(v.string()),
    maxUses: v.number(),
    durationDays: v.number(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.email !== ADMIN_EMAIL) {
      throw userError("Accès administrateur requis.", "ADMIN_REQUIRED");
    }
    const code = args.code?.trim() || randomCode();
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

// ─── List all codes (admin only) ───
export const list = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.email !== ADMIN_EMAIL) return [];
    return await ctx.db.query("accessCodes").take(100);
  },
});

// ─── Submit an access request (open to anonymous visitors) ───
export const requestAccess = mutation({
  args: {
    email: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw userError("Adresse email invalide.", "INVALID_EMAIL");
    }
    // Anyone can call this: one request per address is kept, repeats are
    // dropped, and the free text is capped, so it cannot be used to flood the table.
    const existing = await ctx.db
      .query("accessRequests")
      .filter((q) => q.eq(q.field("email"), email))
      .first();
    if (existing) return { success: true };

    await ctx.db.insert("accessRequests", {
      email,
      message: args.message?.trim().slice(0, 500),
      createdAt: new Date().toISOString(),
    });
    return { success: true };
  },
});

// ─── List access requests (admin only) ───
export const listRequests = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.email !== ADMIN_EMAIL) return [];
    return await ctx.db.query("accessRequests").order("desc").take(100);
  },
});
