"use node";

import Anthropic from "@anthropic-ai/sdk";
import { ConvexError } from "convex/values";
import type { ZodType } from "zod";
import { getProviders, getModel, type AIProvider } from "./providers";
import { userError } from "../_shared/errors";

// ─── User-facing errors ─────────────────────────────────────────────
// Convex redacts plain Error messages in prod; ConvexError.data survives to the
// client. Every user-facing throw goes through userError() (owner:
// convex/_shared/errors.ts, importable from queries and mutations too) so the
// French message + a stable code reach the UI (read via getUserErrorMessage).

/** A ConvexError carrying userMessage, or a legacy plain Error with a French
 *  user-facing message (e.g. normalizers.ts) converted at the boundary so the
 *  text survives Convex prod redaction. Null when not user-facing. */
function toUserFacing(e: unknown): ConvexError<{ userMessage: string; code: string }> | null {
  if (e instanceof ConvexError && typeof (e.data as any)?.userMessage === "string") {
    return e as ConvexError<{ userMessage: string; code: string }>;
  }
  if (e instanceof Error && e.message.startsWith("L'IA a retourné")) {
    return userError(e.message, "AI_INVALID_OUTPUT");
  }
  return null;
}

// ─── Reliability policy ─────────────────────────────────────────────
// Claude is the only provider since 2026-08-16 (see providers.ts for the
// measurements that removed Gemini). The loop is kept, and still matters:
// NEVER wait on a non-last provider, and give the LAST one exactly one retry
// with retry-after-aware backoff, because there is nothing left to fall back
// to. With a single provider that means Claude gets its retry — which is why
// a second provider, if ever added, must go AFTER it and not before.
//
// The SDK defaults to 2 internal retries with exponential backoff, which is
// why "fail fast" used to be slow in practice: a 429 burned ~30s inside the
// SDK before our own loop even saw it. maxRetries: 0 gives the loop full
// control.

// Claude streaming on a >15k-char CV can take ~4 min (K004). The worst case is
// timeout + capped retry-after + timeout, which must stay under the 10-minute
// Convex action limit: at 300 s each it reached 620 s and Convex killed the
// action before our French error could be sent. 270 + 20 + 270 = 560 s.
// The bound is an abort signal on the whole stream: the SDK's own `timeout`
// is cleared once the response headers arrive, so it never bounded the body.
const ANTHROPIC_TIMEOUT_MS = 270_000;
const LAST_PROVIDER_BACKOFF_MS = 5_000;
const MAX_RETRY_AFTER_MS = 20_000;
/**
 * Longest one AI call can take, retry included: what an action must leave room
 * for. Counts one provider (two attempts); a provider added before the last
 * one adds a full timeout (chat.test.ts checks the count).
 */
export const AI_CALL_WORST_CASE_MS =
  ANTHROPIC_TIMEOUT_MS + Math.max(MAX_RETRY_AFTER_MS, LAST_PROVIDER_BACKOFF_MS) + ANTHROPIC_TIMEOUT_MS;

/** An attempt with less time than this left before its deadline is not started */
const MIN_ATTEMPT_MS = 5_000;

const ALL_PROVIDERS_FAILED_MSG =
  "Les services IA sont momentanément indisponibles. Réessayez dans une minute.";

/** Extract an HTTP status from Anthropic SDK errors (they expose `status`). */
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
  if (!text) throw userError("L'IA a retourné une réponse vide. Veuillez réessayer.", "AI_EMPTY_OUTPUT");

  // Sometimes the model wraps JSON in ```json ... ``` markdown blocks
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse AI response as JSON:", text.slice(0, 300));
    throw userError("L'IA a retourné une réponse invalide. Veuillez réessayer.", "AI_INVALID_OUTPUT");
  }
}

/**
 * `fn` gets the time an attempt may take: the call timeout, cut to what is left
 * before `deadlineAt` (epoch ms), so a pipeline of calls ends before the action
 * limit. No attempt and no retry starts without MIN_ATTEMPT_MS left.
 */
export async function withRetry<T>(fn: (provider: AIProvider, timeoutMs: number) => Promise<T>, deadlineAt = Infinity): Promise<T> {
  let providers: AIProvider[];
  try {
    providers = getProviders();
  } catch (e) {
    // A missing API key used to escape as a plain Error, redacted into a generic failure
    console.error("[ai] provider configuration:", e);
    throw userError(ALL_PROVIDERS_FAILED_MSG, "AI_UNAVAILABLE");
  }
  let lastError: any;

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const isLastProvider = i === providers.length - 1;
    const name = "claude";
    const maxAttempts = isLastProvider ? 2 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const timeoutMs = Math.min(ANTHROPIC_TIMEOUT_MS, deadlineAt - Date.now());
      if (timeoutMs < MIN_ATTEMPT_MS) {
        console.log(`[ai] ${name} not called: ${Math.max(0, timeoutMs)}ms left before the deadline`);
        break;
      }
      const startedAt = Date.now();
      try {
        const result = await fn(provider, timeoutMs);
        console.log(`[ai] ${name} ok in ${Date.now() - startedAt}ms`);
        return result;
      } catch (e: any) {
        lastError = e;
        const status = errorStatus(e) ?? "no-status";
        const elapsed = Date.now() - startedAt;

        const delay = retryDelayMs(e);
        if (isLastProvider && attempt === 0 && isRetryable(e) && Date.now() + delay + MIN_ATTEMPT_MS <= deadlineAt) {
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
  // Surface the already-French user-facing errors (empty/invalid response),
  // hide raw SDK errors behind a clear generic one.
  throw toUserFacing(lastError) ?? userError(ALL_PROVIDERS_FAILED_MSG, "AI_UNAVAILABLE");
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

async function rawChatText(provider: AIProvider, prompt: string, speed: "default" | "fast", timeoutMs: number): Promise<string> {
  // max_tokens 30000 requires streaming — client.messages.create() throws
  // "Streaming is required..." (K004). stream().finalMessage() is mandatory.
  // `timeout` still bounds the wait for headers and is sent to the API as
  // X-Stainless-Timeout; the signal below bounds the body.
  const client = new Anthropic({ apiKey: provider.apiKey, timeout: timeoutMs, maxRetries: 0 });
  const stream = client.messages.stream(
    {
      model: getModel(speed, provider),
      max_tokens: 30000,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    },
    { signal: AbortSignal.timeout(timeoutMs) },
  );
  // One parseable line per billed call: cost is read from the Convex logs,
  // never deduced from the code. Sum the lines: a retry is billed again.
  // The last snapshot is kept here because stream.currentMessage is already
  // cleared when a body ends without message_stop.
  let partial: Anthropic.Message | undefined;
  stream.on("streamEvent", (_event, snapshot) => { partial = snapshot; });
  let message: Anthropic.Message;
  try {
    message = await stream.finalMessage();
  } catch (e) {
    // An interrupted stream (abort, dropped connection) was billed too. Its
    // output_tokens is usually still the message_start value (the API sends
    // the real count at the end), so the produced text length is logged beside it.
    if (partial) {
      const output_chars = partial.content.reduce((n, b) => n + (b.type === "text" ? b.text.length : 0), 0);
      console.log("[ai] usage", JSON.stringify({ model: partial.model, usage: partial.usage, output_chars, partial: true }));
    }
    throw e;
  }
  console.log("[ai] usage", JSON.stringify({ model: message.model, usage: message.usage }));
  return extractAnthropicText(message);
}

async function rawChatJSON(provider: AIProvider, prompt: string, speed: "default" | "fast", timeoutMs: number): Promise<any> {
  return safeParseJSON(await rawChatText(provider, prompt, speed, timeoutMs));
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * chatJSON + an arbitrary transform (validator/normalizer) run INSIDE the retry
 * loop. If `transform` throws — e.g. normalizeCVData rejecting a malformed CV
 * via CVDataSchema — that counts as a provider failure and we fall through to
 * the next provider instead of surfacing the error on the first bad response.
 * Use this (not a chat call followed by an out-of-loop normalize) whenever the
 * shape must be validated, so validation shares the same fallback as the call.
 * `deadlineAt` (epoch ms) bounds the call, its retry included.
 */
export async function chatJSONThen<T>(
  prompt: string,
  transform: (raw: any) => T,
  speed: "default" | "fast" = "default",
  deadlineAt?: number,
): Promise<T> {
  return withRetry(async (provider, timeoutMs) => {
    const raw = await rawChatJSON(provider, prompt, speed, timeoutMs);
    return transform(raw);
  }, deadlineAt);
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
  return withRetry(async (provider, timeoutMs) => {
    const raw = await rawChatJSON(provider, prompt, speed, timeoutMs);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      console.warn("[ai] claude JSON failed schema validation:", parsed.error.message.slice(0, 300));
      throw userError("L'IA a retourné une réponse invalide. Veuillez réessayer.", "AI_INVALID_OUTPUT");
    }
    return parsed.data;
  });
}

export async function chatText(prompt: string, speed: "default" | "fast" = "default"): Promise<string> {
  return withRetry(async (provider, timeoutMs) => {
    const text = await rawChatText(provider, prompt, speed, timeoutMs);
    // An empty answer is a failed call, retried, not a result: it used to reach
    // the dashboard as an empty job offer.
    if (!text.trim()) throw userError("L'IA a retourné une réponse vide. Veuillez réessayer.", "AI_EMPTY_OUTPUT");
    return text;
  });
}
