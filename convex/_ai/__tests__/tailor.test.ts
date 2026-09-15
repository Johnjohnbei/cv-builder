import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CVData } from "../../../src/shared/types";

// The AI call is the seam: every answer below is what the model would return
const mocks = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("../chat", () => ({ chatJSONThen: mocks.chat }));

import { tailorPipeline, MAX_REPAIRS, PIPELINE_DEADLINE_MS, REPAIR_CUTOFF_MS } from "../tailor";

const OFFER = "Product Designer. Requis : Figma, recherche utilisateur, maquettes, Kubernetes.";

const SOURCE: CVData = {
  personal_info: {
    name: "Alex Martin", email: "alex@example.com", phone: "+33 6 12 34 56 78", location: "Paris",
    title: "Designer produit", summary: "Designer produit en SaaS B2B.",
  },
  experience: [
    { company: "Acme", position: "Product Designer", start_date: "2020-01", end_date: "2023-06", current: false, description: ["Mené 30 entretiens utilisateurs", "Conçu les maquettes"] },
    { company: "Beta", position: "UI Designer", start_date: "2017-09", end_date: "2019-12", current: false, description: ["Dessiné les écrans mobiles"] },
  ],
  education: [],
  skills: [{ category: "Outils", items: ["Figma", "Sketch"] }],
  languages: [],
};

const requirement = (label: string, kind = "tool") => ({ label, kind, importance: "required", quote: label });
const FIGMA = requirement("Figma");
const RESEARCH = requirement("recherche utilisateur", "method");
const MOCKUPS = requirement("maquettes", "hard_skill");
const KUBERNETES = requirement("Kubernetes");

/** The source CV as the model rewrites it: `edit` changes a copy */
const generated = (edit: (cv: CVData) => void, evidence: { id: string; quote: string }[] = []) => {
  const cv: CVData = structuredClone(SOURCE);
  edit(cv);
  return { cv, evidence };
};

/** The model answers these, in order, through the transform of each call */
const answers = (...raws: unknown[]) =>
  mocks.chat.mockImplementation(async (_prompt: string, transform: (raw: unknown) => unknown) => {
    const next = raws.shift();
    if (next instanceof Error) throw next;
    return transform(typeof next === "function" ? next() : next);
  });

const run = (requirements: unknown[] | undefined, startedAt = Date.now()) =>
  tailorPipeline({ cv: SOURCE, jobDescription: OFFER, requirements }, startedAt);

const covered = (result: Awaited<ReturnType<typeof run>>, id: string) =>
  result.report.requirements.find(c => c.requirement.id === id)?.found;

beforeEach(() => {
  mocks.chat.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("tailorPipeline: requirements", () => {
  it("reuses the client's requirements, checked again against the offer, without extracting", async () => {
    answers(generated(() => {}));
    const result = await run([FIGMA, requirement("Rust")]);
    expect(result.requirements.map(r => r.id)).toEqual(["figma"]);
    expect(mocks.chat).toHaveBeenCalledTimes(1);
  });

  it("extracts them on the fast model when the client has none, each call bounded by its deadline", async () => {
    answers({ requirements: [FIGMA] }, generated(() => {}));
    await run(undefined, 1_000);
    expect(mocks.chat.mock.calls.map(c => c[2])).toEqual(["fast", "default"]);
    expect(mocks.chat.mock.calls[0][3]).toBe(1_000 + 120_000);
    expect(mocks.chat.mock.calls[1][3]).toBe(1_000 + PIPELINE_DEADLINE_MS);
  });
});

describe("tailorPipeline: truth guard", () => {
  it("rejects a generation that drops an experience, so the call is retried", async () => {
    answers(generated(cv => { cv.experience.pop(); }));
    await expect(run([FIGMA])).rejects.toMatchObject({ data: { code: "AI_INVALID_OUTPUT" } });
  });

  it("puts the source's companies and dates back", async () => {
    answers(generated(cv => { cv.experience[0] = { ...cv.experience[0], company: "ACME Corp", start_date: "2019-01", end_date: "2024-01" }; }));
    const { cv } = await run([FIGMA]);
    expect(cv.experience[0]).toMatchObject({ company: "Acme", start_date: "2020-01", end_date: "2023-06" });
  });

  it("removes a requirement the model wrote without proof, and names it as a gap", async () => {
    answers(generated(cv => {
      cv.skills[0].items.push("Kubernetes");
      cv.experience[0].description.splice(1, 0, "Déployé Kubernetes en production");
      cv.personal_info.summary = "Designer produit en SaaS B2B. Expert Kubernetes.";
    }, [{ id: "kubernetes", quote: "Expert Kubernetes" }]));
    const result = await run([FIGMA, KUBERNETES]);
    expect(JSON.stringify(result.cv)).not.toContain("Kubernetes");
    expect(result.cv.experience[0].description).toEqual(["Mené 30 entretiens utilisateurs", "Conçu les maquettes"]);
    expect(result.cv.personal_info.summary).toBe("Designer produit en SaaS B2B.");
    expect(covered(result, "kubernetes")).toBe(false);
    expect(result.unproven).toEqual(["kubernetes"]);
  });

  it("keeps a requirement proven by a quote of the source CV", async () => {
    answers(generated(cv => {
      cv.experience[0].description[0] = "Conduit la recherche utilisateur : 30 entretiens";
    }, [{ id: "recherche-utilisateur", quote: "Mené 30 entretiens utilisateurs" }]));
    const result = await run([FIGMA, RESEARCH]);
    expect(covered(result, "recherche-utilisateur")).toBe(true);
    expect(result.unproven).toEqual([]);
  });

  it("reads a quote the source CV does not contain as no proof", async () => {
    answers(generated(cv => {
      cv.experience[0].description[0] = "Conduit la recherche utilisateur : 30 entretiens";
    }, [{ id: "recherche-utilisateur", quote: "Expert en recherche utilisateur" }]));
    const result = await run([FIGMA, RESEARCH]);
    expect(covered(result, "recherche-utilisateur")).toBe(false);
    expect(result.cv.experience[0].description).toEqual(["Conçu les maquettes"]);
  });
});

describe("tailorPipeline: targeted repair", () => {
  const withoutFigma = () => generated(cv => { cv.skills[0].items = ["Sketch"]; });

  it("writes back a proven requirement the generation left out, on the fast model, then measures again", async () => {
    answers(withoutFigma(), { edits: [{ target: "skills", text: "Figma" }] });
    const result = await run([FIGMA]);
    expect(mocks.chat.mock.calls[1][2]).toBe("fast");
    expect(mocks.chat.mock.calls[1][0]).toContain("Figma");
    expect(covered(result, "figma")).toBe(true);
    expect(result.report.score).toBe(100);
  });

  it(`stops after ${MAX_REPAIRS} repairs`, async () => {
    answers(withoutFigma(), { edits: [] }, { edits: [] }, { edits: [] });
    const result = await run([FIGMA]);
    expect(mocks.chat).toHaveBeenCalledTimes(1 + MAX_REPAIRS);
    expect(covered(result, "figma")).toBe(false);
  });

  it("starts no repair past its cutoff, and returns the version measured", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    answers(() => {
      vi.setSystemTime(REPAIR_CUTOFF_MS + 1);
      return withoutFigma();
    });
    const result = await run([FIGMA], 0);
    expect(mocks.chat).toHaveBeenCalledTimes(1);
    expect(result.report.score).toBe(0);
  });

  it("keeps the better version when a repair loses more than it adds", async () => {
    const carriesTwo = () => generated(cv => {
      cv.skills[0].items = ["Sketch"];
      cv.experience[0].description = ["Conduit la recherche utilisateur sous Figma", "Livré les écrans"];
    }, [{ id: "recherche-utilisateur", quote: "Mené 30 entretiens utilisateurs" }]);
    const loses = { edits: [{ target: "experience", expIndex: 0, bulletIndex: 0, text: "Conçu les maquettes" }] };
    answers(carriesTwo(), loses, loses);
    const result = await run([FIGMA, RESEARCH, MOCKUPS]);
    expect(result.cv.experience[0].description[0]).toBe("Conduit la recherche utilisateur sous Figma");
    expect(covered(result, "maquettes")).toBe(false);
  });

  it("returns the generation when a repair fails, never an error", async () => {
    answers(withoutFigma(), new Error("AI_UNAVAILABLE"));
    const result = await run([FIGMA]);
    expect(mocks.chat).toHaveBeenCalledTimes(2);
    expect(result.cv.skills[0].items).toEqual(["Sketch"]);
  });
});
