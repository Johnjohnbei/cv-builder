"use node";

import OpenAI from "openai";

export interface AIProvider {
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  fastModel: string;
}

// ─── AI Provider Architecture ───
//
// Priority 1: OpenRouter (https://openrouter.ai) — unified OpenAI-compatible gateway
//   to Claude, GPT, Gemini, Llama, and many others via a single endpoint. This is the
//   PRIMARY provider because it lets us use the `openai` SDK for everything without
//   juggling per-provider protocols.
//
// Priority 2: Gemini direct (https://generativelanguage.googleapis.com) — free-tier
//   emergency fallback used if OpenRouter is down. Google exposes an OpenAI-compatible
//   endpoint at /v1beta/openai/, so the same SDK works.
//
// WHY NOT Anthropic native (api.anthropic.com)?
//   The Anthropic native API does NOT expose /chat/completions. It uses /v1/messages
//   with the Messages API schema, which is NOT wire-compatible with the OpenAI SDK.
//   Attempting `new OpenAI({ baseURL: "https://api.anthropic.com/v1/" })` and calling
//   `.chat.completions.create(...)` returns a 404 "page not found" from the edge —
//   this is a protocol mismatch, NOT a key/header issue. Do NOT re-add it.
//   If you need Claude, use OpenRouter with model "anthropic/claude-sonnet-4.5".
//
// WHY NOT NVIDIA NIM (integrate.api.nvidia.com)?
//   As of 260411, the endpoint returns persistent 404 for `meta/llama-3.1-70b-instruct`
//   (deprecated model or API routing change — out of scope to debug). OpenRouter
//   provides Llama models via the same interface, so NVIDIA direct is retired.
//
// Both legacy providers (Claude direct, NVIDIA direct) were removed 260411-nl2.
export function getProviders(): AIProvider[] {
  const providers: AIProvider[] = [];

  // Priority 1: OpenRouter (primary — OpenAI-compatible gateway to all models)
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    providers.push({
      baseURL: "https://openrouter.ai/api/v1/",
      apiKey: openrouterKey,
      defaultModel: "anthropic/claude-sonnet-4.5",
      fastModel: "anthropic/claude-haiku-4.5",
    });
  }

  // Priority 2: Gemini direct (fallback — free-tier emergency path)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    providers.push({
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: geminiKey,
      defaultModel: "gemini-2.5-flash",
      fastModel: "gemini-2.5-flash",
    });
  }

  if (providers.length === 0) {
    throw new Error(
      "No AI provider configured. Set OPENROUTER_API_KEY (primary) or GEMINI_API_KEY (fallback) in Convex env vars."
    );
  }
  return providers;
}

export function getProvider(): AIProvider {
  return getProviders()[0];
}

export function getClient(provider?: AIProvider): OpenAI {
  const p = provider || getProvider();
  return new OpenAI({ baseURL: p.baseURL, apiKey: p.apiKey });
}

export function getModel(
  speed: "default" | "fast" = "default",
  provider?: AIProvider
): string {
  const p = provider || getProvider();
  return speed === "fast" ? p.fastModel : p.defaultModel;
}
