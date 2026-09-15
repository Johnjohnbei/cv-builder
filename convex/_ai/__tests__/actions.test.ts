import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Action handlers run through `_handler` (Convex keeps it there), with the
// access check, the URL checks and the AI call mocked at their module seams.
const mocks = vi.hoisted(() => ({
  verifyAccessCode: vi.fn(),
  isPublicUrl: vi.fn(),
  /** What the model answers to chatJSONThen */
  aiAnswer: undefined as unknown,
  chatJSONThen: vi.fn(),
  chatText: vi.fn(),
}));

vi.mock("../auth", () => ({ verifyAccessCode: mocks.verifyAccessCode }));
vi.mock("../publicUrl", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../publicUrl")>()),
  isPublicUrl: mocks.isPublicUrl,
}));
vi.mock("../chat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../chat")>()),
  chatJSONThen: mocks.chatJSONThen,
  chatText: mocks.chatText,
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

describe("extractJobDescriptionFromURL: Jina first, then the page itself", () => {
  const run = (url: string) => handlerOf<{ url: string }, string>(extractJobDescriptionFromURL)({}, { url });
  const OFFER_PAGE = "<html><script>track()</script><h1>Product Designer Senior</h1><p>Maîtrise de Figma, 5 ans d'expérience.</p></html>";

  beforeEach(() => {
    mocks.isPublicUrl.mockResolvedValue(true);
    mocks.chatText.mockReset().mockResolvedValue("Offre structurée");
  });
  afterEach(() => vi.unstubAllGlobals());

  /** fetch answering Jina with `jina`, the page itself with `page` */
  const stubFetch = (jina: () => Promise<Response>, page: () => Promise<Response>) =>
    vi.stubGlobal("fetch", vi.fn((url: unknown) => (String(url).startsWith("https://r.jina.ai/") ? jina() : page())));

  it("falls back to the page when Jina refuses, and hands its text to the model", async () => {
    stubFetch(async () => new Response("", { status: 429 }), async () => new Response(OFFER_PAGE, { status: 200 }));

    await expect(run("https://jobs.example/offre")).resolves.toBe("Offre structurée");

    const prompt = mocks.chatText.mock.calls[0][0] as string;
    expect(prompt).toContain("Product Designer Senior Maîtrise de Figma, 5 ans d'expérience.");
    expect(prompt).not.toContain("track()");
  });

  it("uses Jina's text when it answers, cut to 15 000 characters", async () => {
    const page = vi.fn();
    stubFetch(async () => new Response(`Offre Product Designer ${"x".repeat(20_000)}`, { status: 200 }), page);

    await run("https://jobs.example/offre");

    const prompt = mocks.chatText.mock.calls[0][0] as string;
    expect(prompt).toContain("Offre Product Designer");
    expect(prompt).not.toContain("x".repeat(15_000));
    expect(page).not.toHaveBeenCalled();
  });

  it("reports a page it could not read, instead of sending nothing to the model", async () => {
    stubFetch(async () => new Response("", { status: 429 }), async () => { throw new Error("socket hang up"); });

    await expect(run("https://jobs.example/offre")).rejects.toMatchObject({ data: { code: "URL_EXTRACT_FAILED" } });
    expect(mocks.chatText).not.toHaveBeenCalled();
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
