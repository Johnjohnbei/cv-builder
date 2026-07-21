import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry, isRetryable, retryDelayMs, safeParseJSON } from "../chat";

const ENV_KEYS = ["GEMINI_API_KEY", "ANTHROPIC_API_KEY"] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.GEMINI_API_KEY = "test-gemini";
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
  it("returns on first provider success without touching the second", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0].protocol).toBe("openai"); // gemini first
  });

  it("falls through to the next provider IMMEDIATELY on failure (no in-provider retry)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("rate limited"), { status: 429 }))
      .mockResolvedValueOnce("fallback-ok");
    const start = Date.now();
    await expect(withRetry(fn)).resolves.toBe("fallback-ok");
    expect(Date.now() - start).toBeLessThan(1000); // no backoff wait on non-last provider
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[0][0].protocol).toBe("openai");
    expect(fn.mock.calls[1][0].protocol).toBe("anthropic");
  });

  it("falls through on schema/parse errors too (no status)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("L'IA a retourné une réponse invalide. Veuillez réessayer."))
      .mockResolvedValueOnce("fallback-ok");
    await expect(withRetry(fn)).resolves.toBe("fallback-ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries the LAST provider once on retryable errors", async () => {
    delete process.env.ANTHROPIC_API_KEY; // single-provider chain
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

  it("does NOT retry the last provider on non-retryable errors", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error("bad request"), { status: 400 }));
    await expect(withRetry(fn)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws a clear French message when all providers fail with SDK errors", async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error("ECONNRESET"), { status: 503 }));
    vi.useFakeTimers();
    const promise = withRetry(fn).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    const err = (await promise) as Error;
    expect(err.message).toContain("momentanément indisponibles");
  });

  it("preserves user-facing L'IA messages when all providers fail", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("L'IA a retourné une réponse vide. Veuillez réessayer."));
    vi.useFakeTimers();
    const promise = withRetry(fn).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    const err = (await promise) as Error;
    expect(err.message).toContain("L'IA a retourné");
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

  it("throws a French error on empty response", () => {
    expect(() => safeParseJSON("")).toThrow(/réponse vide/);
    expect(() => safeParseJSON(null)).toThrow(/réponse vide/);
  });

  it("throws a French error on invalid JSON", () => {
    expect(() => safeParseJSON("not json at all")).toThrow(/réponse invalide/);
  });
});
