import { describe, it, expect, vi, beforeEach } from "vitest";

// Action handlers run through `_handler` (Convex keeps it there), with the
// access check, the URL checks and the AI call mocked at their module seams.
const mocks = vi.hoisted(() => ({
  verifyAccessCode: vi.fn(),
  isPublicUrl: vi.fn(),
  /** What the model answers to chatJSONThen */
  aiAnswer: undefined as unknown,
  chatJSONThen: vi.fn(),
}));

vi.mock("../auth", () => ({ verifyAccessCode: mocks.verifyAccessCode }));
vi.mock("../publicUrl", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../publicUrl")>()),
  isPublicUrl: mocks.isPublicUrl,
}));
vi.mock("../chat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../chat")>()),
  chatJSONThen: mocks.chatJSONThen,
}));

import { extractJobDescriptionFromURL, extractJobRequirements } from "../../ai";

const handlerOf = <A, R>(action: unknown) => (action as { _handler: (ctx: unknown, args: A) => Promise<R> })._handler;

beforeEach(() => {
  mocks.verifyAccessCode.mockReset().mockResolvedValue(undefined);
  mocks.isPublicUrl.mockReset().mockResolvedValue(false);
  mocks.chatJSONThen.mockReset().mockImplementation(async (_prompt: string, transform: (raw: unknown) => unknown) =>
    transform(mocks.aiAnswer));
});

// The order of the URL checks around the access code is the guarantee under
// test: offline checks before the code (a bad link costs no use), DNS after it
// (an anonymous caller cannot probe DNS).
describe("extractJobDescriptionFromURL: URL checks around the access code", () => {
  const run = (url: string) => handlerOf<{ url: string }, string>(extractJobDescriptionFromURL)({}, { url });

  it.each(["not a url", "http://10.0.0.1/", "http://localhost:3000/"])(
    "refuses %s before the access code is used",
    async (url) => {
      await expect(run(url)).rejects.toMatchObject({ data: { code: "URL_INVALID" } });
      expect(mocks.verifyAccessCode).not.toHaveBeenCalled();
      expect(mocks.isPublicUrl).not.toHaveBeenCalled();
    },
  );

  it("never resolves a name for a caller the access check refuses", async () => {
    mocks.verifyAccessCode.mockRejectedValue(new Error("ACCESS_CODE_REQUIRED"));
    await expect(run("https://jobs.example/offre")).rejects.toThrow("ACCESS_CODE_REQUIRED");
    expect(mocks.isPublicUrl).not.toHaveBeenCalled();
  });

  it("resolves the name only after the access code, and refuses a non-public one", async () => {
    await expect(run("https://jobs.example/offre")).rejects.toMatchObject({ data: { code: "URL_UNREACHABLE" } });
    expect(mocks.verifyAccessCode.mock.invocationCallOrder[0]).toBeLessThan(mocks.isPublicUrl.mock.invocationCallOrder[0]);
  });
});

describe("extractJobRequirements", () => {
  const OFFER = "Product Designer Senior. Requis : maîtrise de Figma.";
  const run = (jobDescription: string) =>
    handlerOf<{ jobDescription: string }, { requirements: { id: string }[] }>(extractJobRequirements)({}, { jobDescription });
  const requirement = (label: string, quote: string) => ({ label, kind: "tool", importance: "required", quote });

  it("returns the requirements the offer states, from the fast model", async () => {
    mocks.aiAnswer = { requirements: [requirement("Figma", "maîtrise de Figma"), requirement("Kubernetes", "Kubernetes")] };

    const { requirements } = await run(OFFER);

    expect(requirements.map(r => r.id)).toEqual(["figma"]);
    expect(mocks.chatJSONThen).toHaveBeenCalledWith(expect.stringContaining(OFFER), expect.any(Function), "fast");
  });

  it("checks the access code before any paid call", async () => {
    mocks.verifyAccessCode.mockRejectedValue(new Error("ACCESS_CODE_REQUIRED"));
    await expect(run(OFFER)).rejects.toThrow("ACCESS_CODE_REQUIRED");
    expect(mocks.chatJSONThen).not.toHaveBeenCalled();
  });

  it("refuses an offer too long before the access code is used", async () => {
    await expect(run("x".repeat(20_001))).rejects.toMatchObject({ data: { code: "INPUT_TOO_LONG" } });
    expect(mocks.verifyAccessCode).not.toHaveBeenCalled();
  });

  // Thrown inside the transform, so chatJSONThen retries the call once
  it.each([
    ["no requirement the offer states", { requirements: [requirement("Kubernetes", "Kubernetes")] }],
    ["a malformed root", { requirements: null }],
    ["a list instead of an object", [requirement("Figma", "maîtrise de Figma")]],
  ])("treats an answer with %s as invalid", async (_case, answer) => {
    mocks.aiAnswer = answer;
    await expect(run(OFFER)).rejects.toMatchObject({ data: { code: "AI_INVALID_OUTPUT" } });
  });
});
