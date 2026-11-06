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
 *
 * `counts` says whether this action spends a use. One piece of work asked for
 * costs ONE use, not one per call: generating a CV runs the tailoring, the
 * analysis of the offer and two translations, so a code of five uses was worth
 * one generation and a bit. The calls that serve a piece of work already
 * started are checked like any other (an unknown, expired or exhausted code is
 * refused) without spending a second use.
 */
export async function verifyAccessCode(ctx: any, code?: string, counts = true) {
  if (await ctx.auth.getUserIdentity()) return;
  if (!code?.trim()) {
    throw userError(
      "Code d'accès requis : connectez-vous ou saisissez un code depuis le tableau de bord.",
      "ACCESS_CODE_REQUIRED",
    );
  }

  const { internal, api } = await import("../_generated/api");
  const result = counts
    ? await ctx.runMutation(internal.accessCodes.consumeInternal, { code })
    : await ctx.runQuery(api.accessCodes.verify, { code });
  if (!result.valid) {
    throw userError(result.reason || "Code d'accès invalide.", "ACCESS_CODE_INVALID");
  }
}
