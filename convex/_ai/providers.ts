"use node";

// ─── AIProvider interface ──────────────────────────────────────────
// The `protocol` discriminant exists because Anthropic's native API uses the
// Messages API (`/v1/messages`) with a different request/response shape than
// OpenAI's chat-completions. chat.ts branches on this field to pick the right
// SDK. Do NOT attempt to unify under one baseURL-patched OpenAI client — that
// was attempted and returns 404 on api.anthropic.com/v1/chat/completions
// (revert 67239be). The correct fix is per-vendor SDK via the protocol tag.

export interface AIProvider {
  protocol: "openai" | "anthropic";
  baseURL: string; // kept on both variants for symmetry in withRetry log messages
  apiKey: string;
  defaultModel: string;
  fastModel: string;
}

export function getProviders(): AIProvider[] {
  const providers: AIProvider[] = [];

  // Priority 1: Gemini Flash (free tier, OpenAI-compatible surface)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    providers.push({
      protocol: "openai",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: geminiKey,
      defaultModel: "gemini-2.5-flash",
      fastModel: "gemini-2.5-flash",
    });
  }

  // Priority 2: Claude (quality fallback, native Messages API via @anthropic-ai/sdk)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    providers.push({
      protocol: "anthropic",
      baseURL: "https://api.anthropic.com", // for log symmetry only; SDK ignores this
      apiKey: anthropicKey,
      defaultModel: "claude-sonnet-4-5",
      fastModel: "claude-haiku-4-5-20251001",
    });
  }

  if (providers.length === 0) {
    throw new Error(
      "No AI provider configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in Convex env vars (npx convex env set ...)."
    );
  }
  return providers;
}

export function getModel(
  speed: "default" | "fast" = "default",
  provider?: AIProvider
): string {
  const p = provider || getProviders()[0];
  return speed === "fast" ? p.fastModel : p.defaultModel;
}
