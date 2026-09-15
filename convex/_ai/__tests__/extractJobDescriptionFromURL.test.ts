import { describe, it, expect, vi, beforeEach } from "vitest";

// The order of the URL checks around the access code is the guarantee under
// test: offline checks before the code (a bad link costs no use), DNS after it
// (an anonymous caller cannot probe DNS). Convex keeps the handler on `_handler`.
const mocks = vi.hoisted(() => ({ verifyAccessCode: vi.fn(), isPublicUrl: vi.fn() }));

vi.mock("../auth", () => ({ verifyAccessCode: mocks.verifyAccessCode }));
vi.mock("../publicUrl", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../publicUrl")>()),
  isPublicUrl: mocks.isPublicUrl,
}));

import { extractJobDescriptionFromURL } from "../../ai";

type Handler = (ctx: unknown, args: { url: string; accessCode?: string }) => Promise<string>;
const run = (url: string) => (extractJobDescriptionFromURL as unknown as { _handler: Handler })._handler({}, { url });

describe("extractJobDescriptionFromURL: URL checks around the access code", () => {
  beforeEach(() => {
    mocks.verifyAccessCode.mockReset().mockResolvedValue(undefined);
    mocks.isPublicUrl.mockReset().mockResolvedValue(false);
  });

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
