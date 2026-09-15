import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConvexError } from "convex/values";
import { withRetry, isRetryable, retryDelayMs, safeParseJSON } from "../chat";
import { userError } from "../../_shared/errors";

/** Read the user-facing payload off a thrown error (ConvexError.data). */
const dataOf = (e: unknown) => (e instanceof ConvexError ? (e.data as { userMessage?: string; code?: string }) : {});

const ENV_KEYS = ["ANTHROPIC_API_KEY"] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.ANTHROPIC_API_KEY = "test-anthropic";
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.useRealTimers();
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
