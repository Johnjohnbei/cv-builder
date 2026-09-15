import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConvexError } from "convex/values";

// The Anthropic SDK is the system boundary: mocked here, never called.
const sdk = vi.hoisted(() => ({
  finalMessage: vi.fn(),
  /** The "streamEvent" listener chat.ts registers: called with (event, snapshot) */
  onStreamEvent: undefined as ((event: unknown, snapshot: unknown) => void) | undefined,
  streamOptions: undefined as { signal?: AbortSignal } | undefined,
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      stream: (_body: unknown, options?: { signal?: AbortSignal }) => {
        sdk.streamOptions = options;
        const stream = {
          finalMessage: sdk.finalMessage,
          on(event: string, listener: (event: unknown, snapshot: unknown) => void) {
            if (event === "streamEvent") sdk.onStreamEvent = listener;
            return stream;
          },
        };
        return stream;
      },
    };
  },
}));

/** A stream that delivered part of a message, then failed with `error` */
const interruptedAfter = (snapshot: unknown, error: unknown) => async () => {
  sdk.onStreamEvent?.({ type: "content_block_delta" }, snapshot);
  throw error;
};

import { withRetry, isRetryable, retryDelayMs, safeParseJSON, chatJSONThen, AI_CALL_WORST_CASE_MS } from "../chat";
import { getProviders } from "../providers";
import { userError } from "../../_shared/errors";

/** Read the user-facing payload off a thrown error (ConvexError.data). */
const dataOf = (e: unknown) => (e instanceof ConvexError ? (e.data as { userMessage?: string; code?: string }) : {});

const ENV_KEYS = ["ANTHROPIC_API_KEY"] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.ANTHROPIC_API_KEY = "test-anthropic";
  sdk.finalMessage.mockReset();
  sdk.onStreamEvent = undefined;
  sdk.streamOptions = undefined;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("isRetryable", () => {
  it("retries on transient statuses", () => {
    for (const status of [429, 500, 502, 503, 529]) {
      expect(isRetryable({ status })).toBe(true);
    }
  });

  it("does not retry on client errors", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(isRetryable({ status })).toBe(false);
    }
  });

  it("retries on connection/timeout errors (no status)", () => {
    expect(isRetryable(new Error("Connection error"))).toBe(true);
  });

  it("reads status embedded in message when no status field", () => {
    expect(isRetryable(new Error("got 429 status from provider"))).toBe(true);
    expect(isRetryable(new Error("got 404 status from provider"))).toBe(false);
  });
});

describe("retryDelayMs", () => {
  it("honors retry-after header (seconds → ms)", () => {
    expect(retryDelayMs({ headers: { "retry-after": "3" } })).toBe(3000);
  });

  it("caps retry-after at 20s", () => {
    expect(retryDelayMs({ headers: { "retry-after": "120" } })).toBe(20_000);
  });

  it("supports Headers-like objects with get()", () => {
    const headers = { get: (name: string) => (name === "retry-after" ? "2" : null) };
    expect(retryDelayMs({ headers })).toBe(2000);
  });

  it("falls back to fixed backoff without header", () => {
    expect(retryDelayMs({ status: 429 })).toBe(5000);
  });
});

describe("withRetry", () => {
  // Claude is the only provider since 2026-08-16, so it is also the LAST one —
  // which is what earns it the retry. The fall-through tests that used to live
  // here exercised a second provider that no longer exists; the policy they
  // encoded ("never wait on a non-last provider") is documented in chat.ts and
  // becomes testable again the day a provider is added AFTER Claude.
  it("returns on success without a second call", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries the last provider once on retryable errors", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("overloaded"), { status: 503 }))
      .mockResolvedValueOnce("retried-ok");
    const promise = withRetry(fn);
    await vi.advanceTimersByTimeAsync(6000);
    await expect(promise).resolves.toBe("retried-ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  // A response that parses as JSON but fails the schema throws without a status,
  // which isRetryable treats as transient — so it gets the same second chance.
  it("retries once on schema/parse errors too (no status)", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(userError("L'IA a retourné une réponse invalide. Veuillez réessayer.", "AI_INVALID_OUTPUT"))
      .mockResolvedValueOnce("retried-ok");
    const promise = withRetry(fn);
    await vi.advanceTimersByTimeAsync(6000);
    await expect(promise).resolves.toBe("retried-ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error("bad request"), { status: 400 }));
    await expect(withRetry(fn)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws a ConvexError with a clear French message when all providers fail with SDK errors", async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error("ECONNRESET"), { status: 503 }));
    vi.useFakeTimers();
    const promise = withRetry(fn).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    const err = await promise;
    expect(err).toBeInstanceOf(ConvexError);
    expect(dataOf(err).userMessage).toContain("momentanément indisponibles");
    expect(dataOf(err).userMessage).toContain("Réessayez"); // vouvoiement
    expect(dataOf(err).code).toBe("AI_UNAVAILABLE");
  });

  it("preserves user-facing ConvexError messages across retries when all providers fail", async () => {
    const fn = vi.fn().mockRejectedValue(userError("L'IA a retourné une réponse vide. Veuillez réessayer.", "AI_EMPTY_OUTPUT"));
    vi.useFakeTimers();
    const promise = withRetry(fn).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    const err = await promise;
    expect(err).toBeInstanceOf(ConvexError);
    expect(dataOf(err).userMessage).toContain("L'IA a retourné");
    expect(dataOf(err).code).toBe("AI_EMPTY_OUTPUT");
  });

  it("converts legacy user-facing plain Errors (normalizers) to ConvexError at the boundary", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("L'IA a retourné un CV invalide. Veuillez réessayer."));
    vi.useFakeTimers();
    const promise = withRetry(fn).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    const err = await promise;
    expect(err).toBeInstanceOf(ConvexError);
    expect(dataOf(err).userMessage).toContain("CV invalide");
  });
});

describe("token usage", () => {
  // Cost is measured, never deduced: every successful call logs the served
  // model and its billed tokens, one parseable line in the Convex logs.
  it("logs the served model and its usage after a call", async () => {
    sdk.finalMessage.mockResolvedValueOnce({
      model: "claude-sonnet-4-5-20250929",
      content: [{ type: "text", text: '{"a":1}' }],
      usage: { input_tokens: 1200, output_tokens: 340, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(chatJSONThen("prompt", (raw) => raw)).resolves.toEqual({ a: 1 });

    const lines = log.mock.calls.filter((c) => c[0] === "[ai] usage");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0][1])).toEqual({
      model: "claude-sonnet-4-5-20250929",
      usage: { input_tokens: 1200, output_tokens: 340, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    });
  });
});

describe("call deadline", () => {
  // Actions budget their other waits against this constant (URL action in publicUrl.ts)
  it("states the worst case of one call as two timed-out attempts and the longest pause between them", () => {
    expect(AI_CALL_WORST_CASE_MS).toBe(270_000 + 20_000 + 270_000);
  });

  // withRetry gives every provider but the last one attempt: a second provider
  // adds a full timeout, which AI_CALL_WORST_CASE_MS does not count yet
  it("assumes a single provider", () => {
    expect(getProviders()).toHaveLength(1);
  });

  // The whole stream is bounded, not only the wait for the response headers:
  // the SDK's own timeout is cleared as soon as the headers arrive.
  it("bounds each call with a 270 s abort signal given to the stream", async () => {
    sdk.finalMessage.mockResolvedValueOnce({ model: "m", content: [{ type: "text", text: "{}" }], usage: { input_tokens: 1, output_tokens: 1 } });
    vi.spyOn(console, "log").mockImplementation(() => {});
    const timeout = vi.spyOn(AbortSignal, "timeout");

    await chatJSONThen("prompt", (raw) => raw);

    expect(timeout).toHaveBeenCalledWith(270_000);
    expect(sdk.streamOptions?.signal).toBe(timeout.mock.results[0].value);
  });

  it("answers the French unavailability message when both attempts are aborted", async () => {
    vi.useFakeTimers();
    const aborted = Object.assign(new Error("Request was aborted."), { name: "APIUserAbortError" });
    sdk.finalMessage.mockRejectedValue(aborted);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const promise = chatJSONThen("prompt", (raw) => raw).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(dataOf(await promise).code).toBe("AI_UNAVAILABLE");
    expect(sdk.finalMessage).toHaveBeenCalledTimes(2);
  });

  // A pipeline of calls must end before the action limit: each call gets what is left
  it("gives an attempt only the time left before the deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    sdk.finalMessage.mockResolvedValueOnce({ model: "m", content: [{ type: "text", text: "{}" }], usage: { input_tokens: 1, output_tokens: 1 } });
    vi.spyOn(console, "log").mockImplementation(() => {});
    const timeout = vi.spyOn(AbortSignal, "timeout");

    await chatJSONThen("prompt", (raw) => raw, "fast", 1_060_000);

    expect(timeout).toHaveBeenCalledWith(60_000);
  });

  it("does not retry when the retry could not run before the deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    sdk.finalMessage.mockRejectedValue(Object.assign(new Error("overloaded"), { status: 503 }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const promise = chatJSONThen("prompt", (raw) => raw, "default", 8_000).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(dataOf(await promise).code).toBe("AI_UNAVAILABLE");
    expect(sdk.finalMessage).toHaveBeenCalledTimes(1);
  });

  it("makes no call once the deadline has passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(chatJSONThen("prompt", (raw) => raw, "fast", 9_000)).rejects.toMatchObject({ data: { code: "AI_UNAVAILABLE" } });
    expect(sdk.finalMessage).not.toHaveBeenCalled();
  });
});

describe("token usage of an interrupted stream", () => {
  const PARTIAL = {
    model: "claude-sonnet-4-5-20250929",
    content: [{ type: "text", text: '{"experience": [' }],
    usage: { input_tokens: 1200, output_tokens: 1 },
  };

  // The API reports output tokens only in message_delta, at the end of the stream: mid-stream the SDK
  // snapshot still carries the message_start value, so the produced text length
  // is logged next to it instead of a made-up token count.
  it("logs the input tokens and the text produced before the failure, marked partial, and still retries", async () => {
    vi.useFakeTimers();
    sdk.finalMessage
      .mockImplementationOnce(interruptedAfter(PARTIAL, new Error("stream interrupted")))
      .mockResolvedValueOnce({ model: "claude-sonnet-4-5-20250929", content: [{ type: "text", text: '{"a":1}' }], usage: { input_tokens: 1200, output_tokens: 300 } });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const promise = chatJSONThen("prompt", (raw) => raw);
    await vi.advanceTimersByTimeAsync(6000);
    await expect(promise).resolves.toEqual({ a: 1 });

    const lines = log.mock.calls.filter((c) => c[0] === "[ai] usage").map((c) => JSON.parse(c[1]));
    expect(lines).toEqual([
      { model: "claude-sonnet-4-5-20250929", usage: { input_tokens: 1200, output_tokens: 1 }, output_chars: 16, partial: true },
      { model: "claude-sonnet-4-5-20250929", usage: { input_tokens: 1200, output_tokens: 300 } },
    ]);
  });

  it("rethrows the original error after logging a partial message", async () => {
    sdk.finalMessage.mockImplementationOnce(interruptedAfter(PARTIAL, Object.assign(new Error("bad request"), { status: 400 })));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(chatJSONThen("prompt", (raw) => raw)).rejects.toThrow();

    expect(log.mock.calls.filter((c) => c[0] === "[ai] usage").map((c) => JSON.parse(c[1]))).toEqual([
      { model: PARTIAL.model, usage: PARTIAL.usage, output_chars: 16, partial: true },
    ]);
    // Wrapped, the error would lose its 400 and be retried
    expect(sdk.finalMessage).toHaveBeenCalledTimes(1);
  });

  it("logs nothing when the stream fails before any message started", async () => {
    sdk.finalMessage.mockRejectedValue(Object.assign(new Error("bad request"), { status: 400 }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(chatJSONThen("prompt", (raw) => raw)).rejects.toThrow();

    expect(log.mock.calls.filter((c) => c[0] === "[ai] usage")).toEqual([]);
    // The original error is rethrown: wrapped, it would lose its 400 and be retried
    expect(sdk.finalMessage).toHaveBeenCalledTimes(1);
  });
});

describe("safeParseJSON", () => {
  it("parses plain JSON", () => {
    expect(safeParseJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips markdown code fences", () => {
    expect(safeParseJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(safeParseJSON('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("throws a French ConvexError on empty response", () => {
    for (const input of ["", null]) {
      let caught: unknown;
      try { safeParseJSON(input); } catch (e) { caught = e; }
      expect(caught).toBeInstanceOf(ConvexError);
      expect(dataOf(caught).userMessage).toMatch(/réponse vide/);
      expect(dataOf(caught).code).toBe("AI_EMPTY_OUTPUT");
    }
  });

  it("throws a French ConvexError on invalid JSON", () => {
    let caught: unknown;
    try { safeParseJSON("not json at all"); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(ConvexError);
    expect(dataOf(caught).userMessage).toMatch(/réponse invalide/);
    expect(dataOf(caught).code).toBe("AI_INVALID_OUTPUT");
  });
});
