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

  // Pasted back by their place, an invented degree took the source's school and dates
  it("keeps a degree or a language in the model's words only when they name the source's entry", async () => {
    const withSchool: CVData = {
      ...SOURCE,
      education: [{ school: "ENSCI", degree: "Master design", start_date: "2014", end_date: "2016" }],
      languages: [{ name: "Anglais", proficiency: "B2" }],
    };
    answers(generated(cv => {
      cv.education = [{ school: "HEC", degree: "MBA", start_date: "2010" }, cv.education[0]];
      cv.languages = [{ name: "Espagnol", proficiency: "C1" }, cv.languages[0]];
    }, [], withSchool));
    expect(await run([FIGMA], Date.now(), withSchool)).toMatchObject({ cv: { education: withSchool.education, languages: withSchool.languages } });

    answers(generated(cv => {
      cv.education[0].degree = "Master's degree in design";
      cv.languages[0].name = "English";
    }, [], withSchool));
    const { cv } = await run([FIGMA], Date.now(), withSchool);
    expect(cv.education).toEqual([{ ...withSchool.education[0], degree: "Master's degree in design" }]);
    expect(cv.languages).toEqual([{ name: "English", proficiency: "B2" }]);
  });

  // A shared word kept "Master Design graphique" for a "Licence", "Anglais, allemand" for "Anglais"
  it("puts the source's degree or language back when the model's words add one", async () => {
    const source: CVData = {
      ...SOURCE,
      education: [{ school: "ENSAD", degree: "Licence Design graphique", start_date: "2012", end_date: "2015" }],
      languages: [{ name: "Anglais (C1)", proficiency: "C1" }, { name: "Espagnol", proficiency: "B1" }],
    };
    answers(generated(cv => {
      cv.education[0].degree = "Master Design graphique";
      cv.languages[0].name = "Anglais, allemand";
      cv.languages[1].name = "Espagnol TOEIC 950";
    }, [], source));
    const { cv } = await run([FIGMA], Date.now(), source);
    expect(cv.education).toEqual(source.education);
    expect(cv.languages).toEqual(source.languages);

    answers(generated(cv => { cv.languages[0].name = "English"; }, [], source));
    expect((await run([FIGMA], Date.now(), source)).cv.languages[0].name).toBe("English");
  });

  // A digit or a letter alone is a word too: "Bac+5" for "Bac+2", "M.A." for a BTS
  it("puts the source's degree or language back when the model changes a level, adds an abbreviation or empties it", async () => {
    const source: CVData = {
      ...SOURCE,
      education: [
        { school: "IUT", degree: "Bac+2", field: "Communication", start_date: "2010" },
        { school: "EFAP", degree: "BTS Communication", start_date: "2012" },
        { school: "ENSCI", degree: "Master design", start_date: "2014" },
        { school: "MIT", degree: "B.A. Computer Science", start_date: "2016" },
        { school: "Lycée Hoche", degree: "Bac L", start_date: "2008" },
      ],
      languages: [{ name: "Anglais", proficiency: "C1" }],
    };
    answers(generated(cv => {
      cv.education[0].degree = "Bac+5";
      cv.education[1].degree = "M.A. Communication";
      cv.education[2] = { ...cv.education[2], degree: "", field: "" };
      cv.education[3].degree = "B.S. Computer Science";
      cv.education[4].degree = "Bac S";
      cv.languages[0].name = "";
    }, [], source));
    const { cv } = await run([FIGMA], Date.now(), source);
    expect(cv.education).toEqual(source.education);
    expect(cv.languages).toEqual(source.languages);
  });

  it("reads a quote that shares only a word like « pour » with the requirement as no proof", async () => {
    const source: CVData = { ...SOURCE, personal_info: { ...SOURCE.personal_info, summary: "Designer produit pour le SaaS B2B." } };
    const offer = `${OFFER} Passion pour la data.`;
    answers(generated(cv => {
      cv.personal_info.summary = "Designer produit pour le SaaS B2B. Passion pour la data.";
    }, [{ id: "passion-pour-la-data", quote: "Designer produit pour le SaaS B2B" }], source));
    const result = await run([FIGMA, requirement("Passion pour la data", "soft_skill")], Date.now(), source, offer);
    expect(result.cv.personal_info.summary).toBe("Designer produit pour le SaaS B2B.");
    expect(result.unproven).toEqual(["passion-pour-la-data"]);
  });

  it("reads a quote as proof only when the quote itself shares a word with the requirement", async () => {
    answers(generated(cv => {
      cv.experience[0].description[0] = "Conduit la recherche utilisateur : 30 entretiens";
    }, [{ id: "recherche-utilisateur", quote: "Mené 30 entretiens" }]));
    expect(covered(await run([FIGMA, RESEARCH]), "recherche-utilisateur")).toBe(false);
  });

  // The client strips the language off the CV it sends: the source always read as French
  it("puts the source bullet back when the CV stays in the language the client gives for the source", async () => {
    const sourceEn: CVData = {
      ...SOURCE,
      experience: [{ ...SOURCE.experience[0], description: ["Led 30 user interviews", "Designed the mockups"] }, SOURCE.experience[1]],
    };
    const offerEn = "Product Designer. Required: Figma, user research and a strong portfolio for our design team.";
    answers(generated(cv => { cv.experience[0].description[1] = "Designed mockups for 17 brands"; }, [], sourceEn));
    const { cv } = await tailorPipeline({ cv: sourceEn, jobDescription: offerEn, requirements: [FIGMA], detectedLanguage: "en" });
    expect(cv.experience[0].description).toEqual(["Led 30 user interviews", "Designed the mockups"]);
  });

  it("keeps a number the source's dates give, and puts back a business model with an invented one", async () => {
    answers(generated(cv => {
      cv.personal_info.summary = "Designer produit depuis 2017, 5 ans en SaaS B2B.";
      cv.experience[0].companyBusinessModel = "SaaS 400 clients";
    }));
    const { cv } = await run([FIGMA]);
    expect(cv.personal_info.summary).toBe("Designer produit depuis 2017, 5 ans en SaaS B2B.");
    expect(cv.experience[0].companyBusinessModel).toBeUndefined();
  });

  it("keeps the source's contacts, and no number the source never gives", async () => {
    answers(generated(cv => {
      cv.personal_info.email = "fake@example.org";
      cv.experience[0].kpi = "+40 % de conversion";
      cv.experience[0].description[1] = "Conçu les maquettes de 17 marques";
      // "1" of the date 2020-01 and "12" of 2019-12 are months, not facts
      cv.experience[1].kpi = "Mené 1 500 entretiens";
      cv.experience[1].intro = "Encadré 12 designers.";
    }));
    const { cv } = await run([FIGMA]);
    expect(cv.personal_info.email).toBe("alex@example.com");
    expect(cv.experience[0].kpi).toBe("");
    expect(cv.experience[0].description).toEqual(["Mené 30 entretiens utilisateurs", "Conçu les maquettes"]);
    expect(cv.experience[1]).toMatchObject({ kpi: "", intro: "" });
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
