import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getProviders, getModel, type AIProvider } from "../providers";

// ─── Env var isolation ─────────────────────────────────────────────
// `getProviders()` reads `process.env` at call time, so tests must snapshot
// and restore the three relevant keys to avoid leakage between tests and
// across test files running in the same vitest process.

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

  it("Gemini only → single openai-protocol provider", () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    const providers = getProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].protocol).toBe("openai");
    expect(providers[0].defaultModel).toBe("gemini-2.5-flash");
    expect(providers[0].fastModel).toBe("gemini-2.5-flash");
    expect(providers[0].baseURL).toContain("generativelanguage.googleapis.com");
    expect(providers[0].apiKey).toBe("gemini-test-key");
  });

  it("Anthropic only → single anthropic-protocol provider with current-gen Claude models", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    const providers = getProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].protocol).toBe("anthropic");
    expect(providers[0].defaultModel).toBe("claude-sonnet-4-5");
    expect(providers[0].fastModel).toBe("claude-haiku-4-5-20251001");
    expect(providers[0].apiKey).toBe("sk-ant-test-key");
    // baseURL kept for withRetry log symmetry (SDK ignores it)
    expect(providers[0].baseURL).toContain("anthropic.com");
  });

  it("Both set → Gemini first (priority 1), Claude second (priority 2)", () => {
    process.env.GEMINI_API_KEY = "g-key";
    process.env.ANTHROPIC_API_KEY = "a-key";
    const providers = getProviders();
    expect(providers).toHaveLength(2);
    expect(providers[0].protocol).toBe("openai");
    expect(providers[0].defaultModel).toBe("gemini-2.5-flash");
    expect(providers[1].protocol).toBe("anthropic");
    expect(providers[1].defaultModel).toBe("claude-sonnet-4-5");
  });

  it("Neither set → throws, error mentions both GEMINI_API_KEY and ANTHROPIC_API_KEY, never NVIDIA", () => {
    expect(() => getProviders()).toThrow(/GEMINI_API_KEY/);
    expect(() => getProviders()).toThrow(/ANTHROPIC_API_KEY/);
    try {
      getProviders();
    } catch (e: any) {
      expect(e.message).not.toMatch(/NVIDIA/i);
    }
  });

  it("NVIDIA_API_KEY alone → throws (NVIDIA is removed, not a fallback)", () => {
    process.env.NVIDIA_API_KEY = "nvidia-key";
    expect(() => getProviders()).toThrow(/GEMINI_API_KEY/);
  });

  it("NVIDIA_API_KEY + Gemini → still returns only 1 provider (NVIDIA ignored)", () => {
    process.env.GEMINI_API_KEY = "g-key";
    process.env.NVIDIA_API_KEY = "nvidia-key";
    const providers = getProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].protocol).toBe("openai");
  });
});

describe("getModel()", () => {
  const provider: AIProvider = {
    protocol: "anthropic",
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
