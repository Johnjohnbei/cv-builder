// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getProviders } from "../providers";

// ─── Environment snapshot helpers ───
// Tests must fully isolate process.env mutations to avoid leaking state across suites.
// We snapshot the relevant keys before each test, delete them, and restore after.

const RELEVANT_KEYS = [
  "OPENROUTER_API_KEY",
  "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY",
  "NVIDIA_API_KEY",
] as const;

describe("getProviders()", () => {
  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of RELEVANT_KEYS) {
      snapshot[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of RELEVANT_KEYS) {
      if (snapshot[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = snapshot[key];
      }
    }
  });

  it("returns OpenRouter only when OPENROUTER_API_KEY is the sole key set", () => {
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";

    const providers = getProviders();

    expect(providers).toHaveLength(1);
    expect(providers[0].baseURL).toBe("https://openrouter.ai/api/v1/");
    expect(providers[0].apiKey).toBe("test-openrouter-key");
    expect(providers[0].defaultModel).toBe("anthropic/claude-sonnet-4.5");
    expect(providers[0].fastModel).toBe("anthropic/claude-haiku-4.5");
  });

  it("returns Gemini only when GEMINI_API_KEY is the sole key set", () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";

    const providers = getProviders();

    expect(providers).toHaveLength(1);
    expect(providers[0].baseURL).toContain("generativelanguage.googleapis.com");
    expect(providers[0].apiKey).toBe("test-gemini-key");
    expect(providers[0].defaultModel).toBe("gemini-2.5-flash");
    expect(providers[0].fastModel).toBe("gemini-2.5-flash");
  });

  it("returns OpenRouter then Gemini (in that order) when both keys are set", () => {
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.GEMINI_API_KEY = "test-gemini-key";

    const providers = getProviders();

    expect(providers).toHaveLength(2);
    expect(providers[0].baseURL).toBe("https://openrouter.ai/api/v1/");
    expect(providers[1].baseURL).toContain("generativelanguage.googleapis.com");
  });

  it("throws an Error referencing both OPENROUTER_API_KEY and GEMINI_API_KEY when neither is set", () => {
    expect(() => getProviders()).toThrow(/OPENROUTER_API_KEY/);
    expect(() => getProviders()).toThrow(/GEMINI_API_KEY/);
  });

  it("ignores legacy ANTHROPIC_API_KEY and NVIDIA_API_KEY (regression guard)", () => {
    process.env.ANTHROPIC_API_KEY = "legacy-claude-key";
    process.env.NVIDIA_API_KEY = "legacy-nvidia-key";

    expect(() => getProviders()).toThrow(/OPENROUTER_API_KEY/);
  });
});
