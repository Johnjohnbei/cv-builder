"use node";

import { ConvexError } from "convex/values";

/**
 * Access-code gate for AI actions.
 *
 * Errors are ConvexError so their French message survives Convex's
 * production redaction of plain Error messages: the user must be able to
 * tell "no code" from "expired code" instead of a generic failure.
 */
export async function verifyAccessCode(ctx: any, code?: string) {
  // Admin bypass via env var
  if (process.env.REQUIRE_ACCESS_CODE !== "true") return;
  if (!code) {
    throw new ConvexError({ userMessage: "Code d'accès requis.", code: "ACCESS_CODE_REQUIRED" });
  }

  const { internal } = await import("../_generated/api");
  const result = await ctx.runQuery(internal.accessCodes.verifyInternal, { code });
  if (!result.valid) {
    throw new ConvexError({
      userMessage: result.reason || "Code d'accès invalide.",
      code: "ACCESS_CODE_INVALID",
    });
  }
  // Increment usage
  await ctx.runMutation(internal.accessCodes.incrementUsageInternal, { code });
}
