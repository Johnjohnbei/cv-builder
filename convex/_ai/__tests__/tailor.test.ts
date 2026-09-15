import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CVData } from "../../../src/shared/types";

// The AI call is the seam: every answer below is what the model would return
const mocks = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("../chat", () => ({ chatJSONThen: mocks.chat }));

import { tailorPipeline, MAX_REPAIRS, PIPELINE_DEADLINE_MS, REPAIR_CUTOFF_MS } from "../tailor";

const OFFER = "Product Designer. Requis : Figma, Sketch, recherche utilisateur, maquettes, Kubernetes, Node.js, Master, anglais.";

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
const SKETCH = requirement("Sketch");

/** The source CV as the model rewrites it: `edit` changes a copy */
const generated = (edit: (cv: CVData) => void, evidence: { id: string; quote: string }[] = [], base: CVData = SOURCE) => {
  const cv: CVData = structuredClone(base);
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

const run = (requirements: unknown[] | undefined, startedAt = Date.now(), source: CVData = SOURCE, offer = OFFER) =>
  tailorPipeline({ cv: source, jobDescription: offer, requirements }, startedAt);

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

  // The facts of the bullet survive: the source's bullet at its place comes back
  it("reads a quote the source CV does not contain as no proof, and puts the source bullet back", async () => {
    answers(generated(cv => {
      cv.experience[0].description[0] = "Conduit la recherche utilisateur : 30 entretiens";
    }, [{ id: "recherche-utilisateur", quote: "Expert en recherche utilisateur" }]));
    const result = await run([FIGMA, RESEARCH]);
    expect(covered(result, "recherche-utilisateur")).toBe(false);
    expect(result.cv.experience[0].description).toEqual(["Mené 30 entretiens utilisateurs", "Conçu les maquettes"]);
  });

  it("reads a one-word quote as no proof: any word of the source would do", async () => {
    answers(generated(cv => {
      cv.experience[0].description.push("Déployé Kubernetes en production");
    }, [{ id: "kubernetes", quote: "Designer" }]));
    const result = await run([FIGMA, KUBERNETES]);
    expect(covered(result, "kubernetes")).toBe(false);
    expect(result.unproven).toEqual(["kubernetes"]);
  });

  it("puts the source's degrees, languages and category names back when the model invents them", async () => {
    answers(generated(cv => {
      cv.education = [{ school: "École", degree: "Master en informatique", start_date: "2012" }];
      cv.languages = [{ name: "Anglais", proficiency: "C1" }];
      cv.skills[0].category = "Kubernetes";
    }));
    const result = await run([FIGMA, KUBERNETES, requirement("Master", "education"), requirement("anglais", "language")]);
    expect(result.cv.education).toEqual([]);
    expect(result.cv.languages).toEqual([]);
    expect(result.cv.skills[0]).toMatchObject({ category: "Outils", items: ["Figma", "Sketch"] });
    expect(result.report.requirements.filter(c => c.found).map(c => c.requirement.id)).toEqual(["figma"]);
    // A degree or a language is not a gap a rewrite can close
    expect(result.unproven).toEqual(["kubernetes"]);
  });

  it("removes the whole sentence writing a name with a dot", async () => {
    answers(generated(cv => { cv.personal_info.summary = "Designer produit en SaaS B2B. Expert Node.js et React."; }));
    const result = await run([FIGMA, requirement("Node.js")]);
    expect(result.cv.personal_info.summary).toBe("Designer produit en SaaS B2B.");
    expect(covered(result, "node-js")).toBe(false);
  });

  it("reads the well-formed proofs when one is malformed, instead of rejecting the CV", async () => {
    answers(generated(cv => {
      cv.experience[0].description[0] = "Conduit la recherche utilisateur : 30 entretiens";
    }, [{ id: "figma", quote: null }, { id: "recherche-utilisateur", quote: "Mené 30 entretiens utilisateurs" }] as never));
    const result = await run([FIGMA, RESEARCH]);
    expect(covered(result, "recherche-utilisateur")).toBe(true);
  });

  it("reads a quote that shares no word with the requirement as no proof", async () => {
    answers(generated(cv => { cv.skills[0].items.push("Kubernetes"); }, [{ id: "kubernetes", quote: "Conçu les maquettes" }]));
    const result = await run([FIGMA, KUBERNETES]);
    expect(result.cv.skills[0].items).toEqual(["Figma", "Sketch"]);
    expect(result.unproven).toEqual(["kubernetes"]);
  });

  // The templates print "**Kuber**netes" as Kubernetes: the guard reads what they print
  it("finds a requirement split by markdown", async () => {
    answers(generated(cv => { cv.experience[0].description.push("Déployé **Kuber**netes en production"); }));
    const result = await run([FIGMA, KUBERNETES]);
    expect(JSON.stringify(result.cv)).not.toContain("netes");
  });

  it("drops an invented bullet rather than putting back a source bullet in another language", async () => {
    const offerEn = "Product Designer. Required: Figma, user research and a strong portfolio for our design team.";
    answers(generated(cv => { cv.experience[0].description = ["Led 30 user interviews", "Designed mockups for 17 brands"]; }));
    const { cv } = await run([FIGMA], Date.now(), SOURCE, offerEn);
    expect(cv.experience[0].description).toEqual(["Led 30 user interviews"]);
  });

  it("puts the source's schools, their dates and the language levels back", async () => {
    const withSchool: CVData = {
      ...SOURCE,
      education: [{ school: "ENSCI", degree: "Master design", start_date: "2014", end_date: "2016" }],
      languages: [{ name: "Anglais", proficiency: "B2" }],
    };
    answers(generated(cv => {
      cv.education[0] = { ...cv.education[0], school: "HEC Paris", start_date: "2013" };
      cv.languages[0] = { ...cv.languages[0], proficiency: "C2 bilingue" };
    }, [], withSchool));
    const { cv } = await run([FIGMA], Date.now(), withSchool);
    expect(cv.education[0]).toMatchObject({ school: "ENSCI", start_date: "2014", end_date: "2016" });
    expect(cv.languages[0].proficiency).toBe("B2");
  });

  it("keeps the source's contacts, and no number the source never gives", async () => {
    answers(generated(cv => {
      cv.personal_info.email = "fake@example.org";
      cv.experience[0].kpi = "+40 % de conversion";
      cv.experience[0].description[1] = "Conçu les maquettes de 17 marques";
    }));
    const { cv } = await run([FIGMA]);
    expect(cv.personal_info.email).toBe("alex@example.com");
    expect(cv.experience[0].kpi).toBe("");
    expect(cv.experience[0].description).toEqual(["Mené 30 entretiens utilisateurs", "Conçu les maquettes"]);
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
    const missingThree = generated(cv => {
      cv.skills[0].items = [];
      cv.experience[0].description = ["Mené 30 entretiens utilisateurs"];
    });
    const add = (text: string) => ({ edits: [{ target: "skills", text }] });
    answers(missingThree, add("Figma"), add("Sketch"), add("maquettes"));
    const result = await run([FIGMA, SKETCH, MOCKUPS]);
    expect(mocks.chat).toHaveBeenCalledTimes(1 + MAX_REPAIRS);
    expect([covered(result, "figma"), covered(result, "sketch"), covered(result, "maquettes")]).toEqual([true, true, false]);
  });

  it("stops at a repair that does not raise the score: a second one would not either", async () => {
    answers(withoutFigma(), { edits: [] }, { edits: [] });
    await run([FIGMA]);
    expect(mocks.chat).toHaveBeenCalledTimes(2);
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
    expect(mocks.chat).toHaveBeenCalledTimes(2);
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
