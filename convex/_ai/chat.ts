"use node";

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";
import { getProviders, getModel, type AIProvider } from "./providers";

// ─── Reliability policy ─────────────────────────────────────────────
// The chain is Gemini (free, flaky — 429/503 are routine, see K004) then
// Claude (paid, reliable). Policy: NEVER wait on a non-last provider — any
// failure falls through to the next provider immediately. Only the LAST
// provider gets one retry (with retry-after-aware backoff), because there is
// nothing left to fall back to.
//
// Both SDKs default to 2 internal retries with exponential backoff, which is
// why "fail fast" was slow in practice: a Gemini 429 burned ~30s inside the
// SDK before our own retry loop even saw it. maxRetries: 0 gives the loop
// full control.

const OPENAI_TIMEOUT_MS = 90_000; // Gemini: a call past 90s is hung, not slow
const ANTHROPIC_TIMEOUT_MS = 300_000; // Claude streaming on a >15k-char CV can take ~4 min (K004)
const LAST_PROVIDER_BACKOFF_MS = 5_000;
const MAX_RETRY_AFTER_MS = 20_000;

const ALL_PROVIDERS_FAILED_MSG =
  "Les services IA sont momentanément indisponibles. Réessaie dans une minute.";

function providerName(p: AIProvider): string {
  return p.protocol === "anthropic" ? "claude" : "gemini";
}

/** Extract an HTTP status from SDK errors (both SDKs expose `status`). */
function errorStatus(e: any): number | undefined {
  const status = e?.status ?? e?.response?.status;
  if (typeof status === "number") return status;
  const fromMessage = e?.message?.match(/\b(\d{3}) status\b/)?.[1];
  return fromMessage ? Number(fromMessage) : undefined;
}

/** Retryable = transient server/quota trouble, or a connection/timeout error (no status). */
export function isRetryable(e: any): boolean {
  const status = errorStatus(e);
  if (status === undefined) return true; // timeout / connection reset / DNS
  return [429, 500, 502, 503, 529].includes(status);
}

/** Honor retry-after when the provider sends one (capped), else fixed backoff. */
export function retryDelayMs(e: any): number {
  const header = e?.headers?.["retry-after"] ?? e?.headers?.get?.("retry-after");
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  return LAST_PROVIDER_BACKOFF_MS;
}

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
    const name = providerName(provider);
    const maxAttempts = isLastProvider ? 2 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const startedAt = Date.now();
      try {
        const result = await fn(provider);
        console.log(`[ai] ${name} ok in ${Date.now() - startedAt}ms`);
        return result;
      } catch (e: any) {
        lastError = e;
        const status = errorStatus(e) ?? "no-status";
        const elapsed = Date.now() - startedAt;

        if (isLastProvider && attempt === 0 && isRetryable(e)) {
          const delay = retryDelayMs(e);
          console.log(`[ai] ${name} failed (${status}) after ${elapsed}ms, last provider — retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        console.log(`[ai] ${name} failed (${status}) after ${elapsed}ms${isLastProvider ? "" : ", falling through to next provider"}: ${e?.message?.slice(0, 200)}`);
        break;
      }
    }
  }

  console.error("[ai] all providers failed:", lastError);
  // Surface the already-French user-facing messages (empty/invalid response),
  // hide raw SDK errors behind a clear generic one.
  const isUserFacing = typeof lastError?.message === "string" && lastError.message.startsWith("L'IA a retourné");
  throw isUserFacing ? lastError : new Error(ALL_PROVIDERS_FAILED_MSG);
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

// ─── Per-provider raw calls ─────────────────────────────────────────

async function rawChatText(provider: AIProvider, prompt: string, speed: "default" | "fast"): Promise<string> {
  const m = getModel(speed, provider);

  if (provider.protocol === "anthropic") {
    // max_tokens 30000 requires streaming — client.messages.create() throws
    // "Streaming is required..." (K004). stream().finalMessage() is mandatory.
    const client = new Anthropic({
      apiKey: provider.apiKey,
      timeout: ANTHROPIC_TIMEOUT_MS,
      maxRetries: 0,
    });
    const stream = client.messages.stream({
      model: m,
      max_tokens: 30000,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });
    const response = await stream.finalMessage();
    return extractAnthropicText(response);
  }

  const client = new OpenAI({
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: 0,
  });
  const response = await client.chat.completions.create({
    model: m,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 30000,
  });
  return response.choices[0]?.message?.content || "";
}

async function rawChatJSON(provider: AIProvider, prompt: string, speed: "default" | "fast"): Promise<any> {
  const m = getModel(speed, provider);

  if (provider.protocol === "anthropic") {
    return safeParseJSON(await rawChatText(provider, prompt, speed));
  }

  // OpenAI-compatible path (Gemini): try response_format first, fall back on
  // 400 (some Gemini models reject json_object format).
  const client = new OpenAI({
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: 0,
  });
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
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * chatJSON + an arbitrary transform (validator/normalizer) run INSIDE the retry
 * loop. If `transform` throws — e.g. normalizeCVData rejecting a malformed CV
 * via CVDataSchema — that counts as a provider failure and we fall through to
 * the next provider instead of surfacing the error on the first bad response.
 * Use this (not a chat call followed by an out-of-loop normalize) whenever the
 * shape must be validated, so validation shares the same fallback as the call.
 */
export async function chatJSONThen<T>(
  prompt: string,
  transform: (raw: any) => T,
  speed: "default" | "fast" = "default"
): Promise<T> {
  return withRetry(async (provider) => {
    const raw = await rawChatJSON(provider, prompt, speed);
    return transform(raw);
  });
}

/**
 * chatJSON + Zod validation INSIDE the retry loop: a response that parses as
 * JSON but doesn't match the schema counts as a provider failure, so we fall
 * through to the next provider (or retry the last one) instead of surfacing
 * "format invalide, réessayez" to the user on the first bad shape.
 */
export async function chatJSONSchema<T>(
  prompt: string,
  schema: ZodType<T>,
  speed: "default" | "fast" = "default"
): Promise<T> {
  return withRetry(async (provider) => {
    const raw = await rawChatJSON(provider, prompt, speed);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      console.warn(`[ai] ${providerName(provider)} JSON failed schema validation:`, parsed.error.message.slice(0, 300));
      throw new Error("L'IA a retourné une réponse invalide. Veuillez réessayer.");
    }
    return parsed.data;
  });
}

export async function chatText(prompt: string, speed: "default" | "fast" = "default"): Promise<string> {
  return withRetry((provider) => rawChatText(provider, prompt, speed));
}
