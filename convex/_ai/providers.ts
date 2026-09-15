"use node";

// ─── AIProvider ────────────────────────────────────────────────────
//
// Claude is the only provider, since 2026-08-16.
//
// Gemini used to sit in front of it, on the premise that its free tier would
// absorb most of the traffic. Measured in the Convex logs, that premise did not
// hold on two counts. Its daily free quota was exhausted after a few dozen
// calls, and every request past that point paid a wasted 60-840 ms round trip
// before falling through — the "fallback" protected against nothing, because it
// answered nothing. And when it did answer, it was 4.4x slower than Claude on
// the most frequent call (median 8 167 ms against 1 847 ms over 128 samples).
//
// The chain was therefore trading the latency the user feels against a spend of
// about 0.18 $ over two days. Removed. If a second provider is ever wanted for
// genuine outage resilience, add it AFTER Claude and give it its own retry
// policy — see withRetry, which only retries the last provider in the list.
//
// The `protocol` discriminant went with it: it existed solely because Gemini
// speaks the OpenAI chat-completions shape while Anthropic uses the Messages
// API. With one vendor there is nothing to branch on. Do NOT reintroduce a
// baseURL-patched OpenAI client for Anthropic — that was tried and returns 404
// on api.anthropic.com/v1/chat/completions (revert 67239be).

export interface AIProvider {
  apiKey: string;
  defaultModel: string;
  fastModel: string;
}

export function getProviders(): AIProvider[] {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    throw new Error(
      "No AI provider configured. Set ANTHROPIC_API_KEY in Convex env vars (npx convex env set ANTHROPIC_API_KEY ...)."
    );
  }

  return [{
    apiKey: anthropicKey,
    defaultModel: "claude-sonnet-4-5",
    fastModel: "claude-haiku-4-5-20251001",
  }];
}

export function getModel(
  speed: "default" | "fast" = "default",
  provider?: AIProvider
): string {
  const p = provider || getProviders()[0];
  return speed === "fast" ? p.fastModel : p.defaultModel;
}
