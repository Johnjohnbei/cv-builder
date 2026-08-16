import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getProviders, getModel, type AIProvider } from "../providers";

// ─── Env var isolation ─────────────────────────────────────────────
// `getProviders()` reads `process.env` at call time, so tests must snapshot
// and restore the relevant keys to avoid leakage between tests and across
// test files running in the same vitest process.
//
// GEMINI_API_KEY and NVIDIA_API_KEY are still snapshotted on purpose: both are
// removed from the chain, and the point of these tests is that a key left
// behind in an environment can never resurrect a provider.

type EnvSnapshot = {
  GEMINI_API_KEY: string | undefined;
  ANTHROPIC_API_KEY: string | undefined;
  NVIDIA_API_KEY: string | undefined;
};

describe("getProviders() — env-var → provider list mapping", () => {
  let saved: EnvSnapshot;

  beforeEach(() => {
    saved = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
    };
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.NVIDIA_API_KEY;
  });

  afterEach(() => {
    if (saved.GEMINI_API_KEY === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = saved.GEMINI_API_KEY;
    if (saved.ANTHROPIC_API_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = saved.ANTHROPIC_API_KEY;
    if (saved.NVIDIA_API_KEY === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = saved.NVIDIA_API_KEY;
  });

  it("Anthropic only → a single provider with current-gen Claude models", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    const providers = getProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].defaultModel).toBe("claude-sonnet-4-5");
    expect(providers[0].fastModel).toBe("claude-haiku-4-5-20251001");
    expect(providers[0].apiKey).toBe("sk-ant-test-key");
    // baseURL kept for withRetry log symmetry (SDK ignores it)
    expect(providers[0].baseURL).toContain("anthropic.com");
  });

  // Removed 2026-08-16: its free daily quota ran out after a few dozen calls,
  // and it answered 4.4x slower than Claude when it answered at all. A key left
  // in the environment must not bring it back.
  it("GEMINI_API_KEY left in the env → ignored, Claude stays the only provider", () => {
    process.env.GEMINI_API_KEY = "g-key";
    process.env.ANTHROPIC_API_KEY = "a-key";
    const providers = getProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].defaultModel).toBe("claude-sonnet-4-5");
  });

  it("GEMINI_API_KEY alone → throws, Gemini is not a provider anymore", () => {
    process.env.GEMINI_API_KEY = "g-key";
    expect(() => getProviders()).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("NVIDIA_API_KEY alone → throws (NVIDIA was removed in 2026-07)", () => {
    process.env.NVIDIA_API_KEY = "nvidia-key";
    expect(() => getProviders()).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("Nothing set → throws, and the message names the only key that matters", () => {
    expect(() => getProviders()).toThrow(/ANTHROPIC_API_KEY/);
    try {
      getProviders();
    } catch (e: any) {
      expect(e.message).not.toMatch(/NVIDIA/i);
      expect(e.message).not.toMatch(/GEMINI/i);
    }
  });
});

describe("getModel()", () => {
  const provider: AIProvider = {
    baseURL: "https://api.anthropic.com",
    apiKey: "test",
    defaultModel: "claude-sonnet-4-5",
    fastModel: "claude-haiku-4-5-20251001",
  };

  it("returns defaultModel when speed='default'", () => {
    expect(getModel("default", provider)).toBe("claude-sonnet-4-5");
  });

  it("returns fastModel when speed='fast'", () => {
    expect(getModel("fast", provider)).toBe("claude-haiku-4-5-20251001");
  });
});
