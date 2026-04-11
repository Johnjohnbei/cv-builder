"use node";

export async function verifyAccessCode(ctx: any, code?: string) {
  // Admin bypass via env var
  if (process.env.REQUIRE_ACCESS_CODE !== "true") return;
  if (!code) throw new Error("Code d'accès requis.");

  const { internal } = await import("../_generated/api");
  const result = await ctx.runQuery(internal.accessCodes.verifyInternal, { code });
  if (!result.valid) {
    throw new Error(result.reason || "Code d'accès invalide.");
  }
  // Increment usage
  await ctx.runMutation(internal.accessCodes.incrementUsageInternal, { code });
}
