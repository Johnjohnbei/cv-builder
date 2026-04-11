"use node";

import OpenAI from "openai";

export interface AIProvider {
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  fastModel: string;
}

export function getProviders(): AIProvider[] {
  const providers: AIProvider[] = [];

  // Priority 1: Gemini Flash (free tier)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    providers.push({
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: geminiKey,
      defaultModel: "gemini-2.5-flash",
      fastModel: "gemini-2.5-flash",
    });
  }

  // Priority 2: Claude (best quality, fallback)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    providers.push({
      baseURL: "https://api.anthropic.com/v1/",
      apiKey: anthropicKey,
      defaultModel: "claude-sonnet-4-20250514",
      fastModel: "claude-haiku-4-5-20251001",
    });
  }

  // Priority 3: NVIDIA NIM (free tier)
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey) {
    providers.push({
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey: nvidiaKey,
      defaultModel: "meta/llama-3.1-70b-instruct",
      fastModel: "meta/llama-3.1-70b-instruct",
    });
  }

  if (providers.length === 0) {
    throw new Error(
      "No AI provider configured. Set ANTHROPIC_API_KEY, GEMINI_API_KEY, or NVIDIA_API_KEY in Convex env vars."
    );
  }
  return providers;
}

export function getProvider(): AIProvider {
  return getProviders()[0];
}

export function getClient(provider?: AIProvider): OpenAI {
  const p = provider || getProvider();
  const opts: any = { baseURL: p.baseURL, apiKey: p.apiKey };
  // Anthropic requires extra headers for OpenAI compatibility
  if (p.baseURL.includes("anthropic.com")) {
    opts.defaultHeaders = { "anthropic-version": "2023-06-01" };
  }
  return new OpenAI(opts);
}

export function getModel(
  speed: "default" | "fast" = "default",
  provider?: AIProvider
): string {
  const p = provider || getProvider();
  return speed === "fast" ? p.fastModel : p.defaultModel;
}
