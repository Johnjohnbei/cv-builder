"use node";

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { getProviders, getModel, type AIProvider } from "./providers";

export function safeParseJSON(text: string | undefined | null, _fallback: any = {}): any {
  if (!text) throw new Error("L'IA a retourné une réponse vide. Veuillez réessayer.");

  // Sometimes the model wraps JSON in ```json ... ``` markdown blocks
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse AI response as JSON:", text.slice(0, 300));
    throw new Error("L'IA a retourné une réponse invalide. Veuillez réessayer.");
  }
}

export async function withRetry<T>(fn: (provider: AIProvider) => Promise<T>): Promise<T> {
  const providers = getProviders();
  let lastError: any;

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const isLastProvider = i === providers.length - 1;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await fn(provider);
      } catch (e: any) {
        lastError = e;
        const status = e?.status || e?.message?.match(/(\d{3}) status/)?.[1];
        // Fail-fast on 503 (service unavailable): the next provider is usually
        // more useful than retrying a hung provider. Only retry on 429 (rate
        // limit) — a short backoff often suffices and there's no point burning
        // tokens on the fallback if the current provider just needs a breather.
        // On the LAST provider we retry once on 503 too (no fallback available).
        const shouldRetry = attempt === 0 && (
          status == 429 ||
          (status == 503 && isLastProvider)
        );
        if (shouldRetry) {
          console.log(`AI provider ${provider.baseURL} returned ${status}, retrying once...`);
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        console.log(`AI provider ${provider.baseURL} failed (${status}), trying next provider...`);
        break; // try next provider
      }
    }
  }
  throw lastError;
}

// ─── Anthropic response extraction ─────────────────────────────────
// Messages API returns `{ content: [{ type: "text", text: "..." }, ...] }`.
// We only emit a single user message with a text prompt, so we expect a single
// text block back. Defensive: if the first block is missing or not a text
// block, return an empty string — safeParseJSON will then throw a clear
// "empty response" error in the chatJSON path, and chatText will return "".
function extractAnthropicText(response: Anthropic.Message): string {
  const first = response.content[0];
  return first && first.type === "text" ? first.text : "";
}

export async function chatJSON(prompt: string, speed: "default" | "fast" = "default"): Promise<any> {
  return withRetry(async (provider) => {
    const m = getModel(speed, provider);

    if (provider.protocol === "anthropic") {
      const client = new Anthropic({ apiKey: provider.apiKey });
      const stream = client.messages.stream({
        model: m,
        max_tokens: 30000,
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
      });
      const response = await stream.finalMessage();
      return safeParseJSON(extractAnthropicText(response));
    }

    // OpenAI-compatible path (Gemini). Unchanged behavior: try response_format
    // first, fall back on 400 (some Gemini models reject json_object format).
    const client = new OpenAI({ baseURL: provider.baseURL, apiKey: provider.apiKey });
    try {
      const response = await client.chat.completions.create({
        model: m,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 30000,
        response_format: { type: "json_object" },
      });
      return safeParseJSON(response.choices[0]?.message?.content);
    } catch (e: any) {
      if (e?.status === 400 || e?.message?.includes("400")) {
        const response = await client.chat.completions.create({
          model: m,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 30000,
        });
        return safeParseJSON(response.choices[0]?.message?.content);
      }
      throw e;
    }
  });
}

export async function chatText(prompt: string, speed: "default" | "fast" = "default"): Promise<string> {
  return withRetry(async (provider) => {
    const m = getModel(speed, provider);

    if (provider.protocol === "anthropic") {
      const client = new Anthropic({ apiKey: provider.apiKey });
      const stream = client.messages.stream({
        model: m,
        max_tokens: 30000,
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
      });
      const response = await stream.finalMessage();
      return extractAnthropicText(response);
    }

    const client = new OpenAI({ baseURL: provider.baseURL, apiKey: provider.apiKey });
    const response = await client.chat.completions.create({
      model: m,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 30000,
    });
    return response.choices[0]?.message?.content || "";
  });
}
