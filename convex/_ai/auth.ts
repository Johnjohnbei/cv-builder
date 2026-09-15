"use node";

import { userError } from "../_shared/errors";

/**
 * Gate for the paid AI actions: a signed-in account, or a valid access code.
 *
 * Until 2026-09-15 the whole check sat behind REQUIRE_ACCESS_CODE, an env var
 * never set in production: every action was open to anonymous callers and
 * billed on the Anthropic key, whatever the dashboard modal suggested.
 *
 * A code is checked and counted in one mutation (consumeInternal), so
 * concurrent calls cannot use it beyond maxUses.
 */
export async function verifyAccessCode(ctx: any, code?: string) {
  if (await ctx.auth.getUserIdentity()) return;
  if (!code?.trim()) {
    throw userError(
      "Code d'accès requis : connectez-vous ou saisissez un code depuis le tableau de bord.",
      "ACCESS_CODE_REQUIRED",
    );
  }

  const { internal } = await import("../_generated/api");
  const result = await ctx.runMutation(internal.accessCodes.consumeInternal, { code });
  if (!result.valid) {
    throw userError(result.reason || "Code d'accès invalide.", "ACCESS_CODE_INVALID");
  }
}
