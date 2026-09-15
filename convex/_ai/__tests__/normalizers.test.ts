import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeCVData,
  normalizeExperience,
  normalizeSkills,
  normalizeProficiency,
  normalizeTitle,
  withoutUserOwnedFields,
  restoreUserOwnedFields,
  normalizeJobRequirements,
} from "../normalizers";
import cvClean from "./fixtures/cv-clean.json";
import cvDirty from "./fixtures/cv-dirty.json";
import cvLegacy from "./fixtures/cv-legacy-no-kpi.json";
import cvMalformed from "./fixtures/cv-malformed.json";

describe("normalizeProficiency", () => {
  // The backend no longer freezes proficiency to a localized string — it keeps
  // the RAW value so the render-side owner (formatting.ts) can localize FR↔EN.
  it("keeps the raw LinkedIn value (localization happens at render)", () => {
    expect(normalizeProficiency("Full Professional Proficiency")).toBe("Full Professional Proficiency");
  });
  it("keeps 'native or bilingual' raw", () => {
    expect(normalizeProficiency("native or bilingual")).toBe("native or bilingual");
  });
  it("trims surrounding whitespace", () => {
    expect(normalizeProficiency("  Elementary  ")).toBe("Elementary");
  });
  it("passes through arbitrary proficiencies unchanged", () => {
    expect(normalizeProficiency("Natif")).toBe("Natif");
  });
  it("returns empty string for undefined", () => {
    expect(normalizeProficiency(undefined)).toBe("");
  });
});

describe("normalizeTitle", () => {
  it("keeps short titles unchanged", () => {
    expect(normalizeTitle("Senior Designer")).toBe("Senior Designer");
  });
  it("truncates at | for long titles", () => {
    expect(
      normalizeTitle("Senior Designer | Product Manager | Growth Lead and more")
    ).toBe("Senior Designer");
  });
  it("truncates at , for long titles", () => {
    expect(
      normalizeTitle("Senior Product Designer, Leadership, Management, Coaching")
    ).toBe("Senior Product Designer");
  });
  it("returns undefined for undefined input", () => {
    expect(normalizeTitle(undefined)).toBeUndefined();
  });
});

describe("normalizeExperience", () => {
  it("coerces end_date='présent' to current=true and empties end_date", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", end_date: "présent",
      current: false, description: [],
    });
    expect(result.current).toBe(true);
    expect(result.end_date).toBe("");
  });

  it("treats an empty end_date as current when the model gave no flag", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", end_date: "", description: [],
    });
    expect(result.current).toBe(true);
  });

  it("keeps a past role with an unknown end date as past", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", end_date: "",
      current: false, description: [],
    });
    expect(result.current).toBe(false);
  });

  it("recognizes other ways of saying 'present'", () => {
    for (const end_date of ["Aujourd'hui", "aujourd’hui", "En cours", "Today", "PRÉSENT"]) {
      const result = normalizeExperience({ company: "A", position: "B", start_date: "2020", end_date, current: false, description: [] });
      expect(result.current, end_date).toBe(true);
      expect(result.end_date, end_date).toBe("");
    }
  });

  // Absence must survive normalization: it is the signal useFitToPages reads to
  // know the CV has never been triaged and to fit it from real measurements.
  it("leaves displayMode undefined when missing", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
    });
    expect(result.displayMode).toBeUndefined();
  });

  it("leaves displayMode undefined when invalid", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
      displayMode: "super-ultra",
    });
    expect(result.displayMode).toBeUndefined();
  });

  it("keeps the company tags deduced by the same call", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
      companyStage: "Scaleup", companyBusinessModel: "SaaS",
    });
    expect(result.companyStage).toBe("Scaleup");
    expect(result.companyBusinessModel).toBe("SaaS");
  });

  it("preserves valid displayMode", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
      displayMode: "extended",
    });
    expect(result.displayMode).toBe("extended");
  });

  it("trims kpi string", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
      kpi: "  35% growth  ",
    });
    expect(result.kpi).toBe("35% growth");
  });

  it("defaults kpi to empty string when missing", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
    });
    expect(result.kpi).toBe("");
  });

  it("keeps every bullet, even beyond 5", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false,
      description: ["1", "2", "3", "4", "5", "6", "7"],
    });
    expect(result.description).toHaveLength(7);
  });

  it("keeps a long bullet intact, hyphens and short words included", () => {
    const longBullet =
      "Pilote la stratégie produit B2B - SaaS pour 3 marchés européens, en coordonnant design, data et engineering sur une refonte complète du parcours d'onboarding, de la recherche utilisateur jusqu'au suivi des KPIs - UX";
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false,
      description: [longBullet],
    });
    expect(result.description).toEqual([longBullet]);
  });

  it("splits bullets glued with line breaks or • markers, and drops non-text", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false,
      description: ["• Premier point • Deuxième point", "Troisième\nQuatrième", 42],
    });
    expect(result.description).toEqual(["Premier point", "Deuxième point", "Troisième", "Quatrième"]);
  });

  it("passes showKpi boolean through", () => {
    const r1 = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
      showKpi: true,
    });
    expect(r1.showKpi).toBe(true);
    const r2 = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
      showKpi: false,
    });
    expect(r2.showKpi).toBe(false);
    const r3 = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
    });
    expect(r3.showKpi).toBeUndefined();
  });
});

describe("normalizeSkills", () => {
  it("coerces object items to strings via .name", () => {
    const result = normalizeSkills([
      { category: "Tech", items: [{ name: "React" }, { skill: "TypeScript" }, "Plain"] },
    ]);
    expect(result[0].items).toContain("React");
    expect(result[0].items).toContain("TypeScript");
    expect(result[0].items).toContain("Plain");
  });

  it("dedupes items case-insensitively", () => {
    const result = normalizeSkills([
      { category: "Tech", items: ["React", "react", "REACT"] },
    ]);
    expect(result[0].items).toHaveLength(1);
  });

  it("keeps every item of a category", () => {
    const result = normalizeSkills([
      { category: "Tech", items: Array.from({ length: 12 }, (_, i) => `Skill${i}`) },
    ]);
    expect(result[0].items).toHaveLength(12);
  });

  it("keeps every category", () => {
    const result = normalizeSkills(
      Array.from({ length: 8 }, (_, i) => ({ category: `Cat${i}`, items: ["a"] }))
    );
    expect(result).toHaveLength(8);
  });

  it("defaults category to 'Compétences' when missing", () => {
    const result = normalizeSkills([{ items: ["a"] }]);
    expect(result[0].category).toBe("Compétences");
  });
});

describe("user-owned fields around an AI rewrite", () => {
  const source = {
    personal_info: {
      name: "Jane", email: "j@e.com", title: "Designer",
      photo_url: "data:image/jpeg;base64,AAAA",
      portfolio_url: "https://example.com/portfolio/ds",
      portfolio_label: "Portfolio Design System",
      portfolio_anon_url: "https://example.com/cv/ab12",
    },
    experience: [],
  };

  it("keeps the photo and the portfolio out of what the model sees", () => {
    const forModel = withoutUserOwnedFields(source);
    expect(Object.keys(forModel.personal_info)).toEqual(["name", "email", "title"]);
    expect(source.personal_info.photo_url).toBeDefined(); // input untouched
  });

  it("puts them back on the answer even though the normalizer dropped them", () => {
    const answer = normalizeCVData({ personal_info: { name: "Jane", email: "j@e.com", title: "Lead Designer" } });
    const restored = restoreUserOwnedFields(answer, source);
    expect(restored.personal_info.title).toBe("Lead Designer");
    expect(restored.personal_info.portfolio_url).toBe("https://example.com/portfolio/ds");
    expect(restored.personal_info.portfolio_label).toBe("Portfolio Design System");
    expect(restored.personal_info.portfolio_anon_url).toBe("https://example.com/cv/ab12");
    expect(restored.personal_info.photo_url).toBe("data:image/jpeg;base64,AAAA");
  });

  it("discards a photo the model made up", () => {
    const answer = normalizeCVData({ personal_info: { name: "Jane", email: "j@e.com", photo_url: "https://invented.jpg" } });
    const restored = restoreUserOwnedFields(answer, { personal_info: { name: "Jane", email: "j@e.com" } });
    expect(restored.personal_info.photo_url).toBeUndefined();
  });
});

describe("normalizeCVData (top-level)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("normalizes a clean fixture end-to-end", () => {
    const result = normalizeCVData(cvClean);
    expect(result.personal_info.name).toBe("Jane Doe");
    expect(result.experience[0].displayMode).toBe("extended");
    expect(result.experience[0].kpi).toBe("Équipe de 8 designers encadrée");
  });

  it("normalizes a dirty fixture", () => {
    const result = normalizeCVData(cvDirty);
    expect(result.personal_info.title).toBe("Very Long Title With Many Words");
    // experience[0] end_date was "présent" -> coerced to current=true, end_date=""
    expect(result.experience[0].current).toBe(true);
    expect(result.experience[0].end_date).toBe("");
    expect(result.experience[0].kpi).toBe("35% growth");
    // Skill item coercion
    expect(result.skills[0].items).toContain("React");
    // Language proficiency kept RAW (localized at render, not frozen to French)
    expect(result.languages[0].proficiency).toBe("full professional proficiency");
  });

  it("handles legacy fixture without kpi/displayMode (left untriaged)", () => {
    const result = normalizeCVData(cvLegacy);
    expect(result.experience[0].displayMode).toBeUndefined();
    expect(result.experience[0].kpi).toBe("");
    expect(result.experience[0].showKpi).toBeUndefined();
  });

  it("throws on malformed (non-object) input", () => {
    expect(() => normalizeCVData(cvMalformed)).toThrow(/CV invalide/);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("accepts null on optional fields instead of rejecting the whole CV", () => {
    const result = normalizeCVData({
      personal_info: { name: "X", email: "y@z.com", phone: null, location: null },
      experience: [{ company: "A", position: "B", start_date: "2020", end_date: null, current: false, kpi: null, description: ["ok", null] }],
      education: [{ school: "S", degree: "D", end_date: null }],
    });
    expect(result.personal_info.phone).toBeUndefined();
    expect(result.experience[0].description).toEqual(["ok"]);
    expect(result.experience[0].kpi).toBe("");
    expect(result.education[0].end_date).toBeUndefined();
  });

  it("returns empty arrays for missing sections", () => {
    const result = normalizeCVData({ personal_info: { name: "X", email: "y@z.com" } });
    expect(result.experience).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.languages).toEqual([]);
  });
});

describe("normalizeJobRequirements", () => {
  const OFFER = "Product Designer Senior (H/F). Requis : maîtrise de Figma, 5 ans d'expérience. Anglais courant apprécié.";
  const req = (over: Record<string, unknown> = {}) => ({
    label: "Figma", variants: [], kind: "tool", importance: "required", quote: "maîtrise de Figma", ...over,
  });

  it("keeps a requirement quoted from the offer, accents and spacing aside, with an id from its label", () => {
    const [figma, ...rest] = normalizeJobRequirements([req({ quote: "MAITRISE  de figma" })], OFFER);
    expect(rest).toEqual([]);
    expect(figma).toMatchObject({ id: "figma", label: "Figma", kind: "tool", importance: "required" });
  });

  // An offer pasted by the user can carry instructions: a requirement the offer
  // does not state is dropped, whatever the model claims.
  it("drops a requirement whose quote is not in the offer", () => {
    expect(normalizeJobRequirements([req({ label: "Kubernetes", quote: "Kubernetes indispensable" })], OFFER)).toEqual([]);
  });

  it("drops malformed items instead of failing the whole list", () => {
    const out = normalizeJobRequirements(["Figma", null, req({ kind: "skill" }), req({ label: "  " }), req()], OFFER);
    expect(out.map(r => r.id)).toEqual(["figma"]);
  });

  it("keeps the first of two requirements with the same id", () => {
    const out = normalizeJobRequirements([req(), req({ label: "figma", importance: "preferred" })], OFFER);
    expect(out).toHaveLength(1);
    expect(out[0].importance).toBe("required");
  });

  it("cleans variants: trimmed, deduplicated, never the label itself", () => {
    const [ux] = normalizeJobRequirements(
      [req({ label: "Product Designer", kind: "title", quote: "Product Designer Senior", variants: [" UX Designer ", "ux designer", "product designer", ""] })],
      OFFER,
    );
    expect(ux.variants).toEqual(["UX Designer"]);
  });

  it("keeps years of experience only with a positive minYears that its quote states", () => {
    const years = req({ label: "5 ans d'expérience", kind: "experience_years", quote: "5 ans d'expérience" });
    expect(normalizeJobRequirements([{ ...years, minYears: 5 }], OFFER)[0].minYears).toBe(5);
    expect(normalizeJobRequirements([years], OFFER)).toEqual([]);
    expect(normalizeJobRequirements([{ ...years, minYears: 8 }], OFFER)).toEqual([]);
  });

  // "un" or a "5" of "Bac+5" is in almost every quote: the number must count years
  it("reads years only as a number followed by a year unit", () => {
    const offer = "Un bon niveau et 3 ans d'expérience. Bac+5. Trois à cinq années en agence. 5+ years of design. At least two (2) years.";
    const years = (quote: string, minYears: number) =>
      normalizeJobRequirements([req({ label: "Expérience", kind: "experience_years", quote, minYears })], offer).length;
    expect(years("Un bon niveau et 3 ans d'expérience", 1)).toBe(0);
    expect(years("Un bon niveau et 3 ans d'expérience", 3)).toBe(1);
    expect(years("Bac+5", 5)).toBe(0);
    expect(years("Trois à cinq années en agence", 3)).toBe(1);
    expect(years("5+ years of design", 5)).toBe(1);
    expect(years("At least two (2) years", 2)).toBe(1);
  });

  it("reads the ranges offers write years with", () => {
    const offer = "Entre 3 et 5 ans d'expérience. Between 3 and 5 years of experience. 3/5 ans en agence. Entre trois et cinq ans.";
    const kept = (quote: string) =>
      normalizeJobRequirements([req({ label: "Expérience", kind: "experience_years", quote, minYears: 3 })], offer).length;
    expect(kept("Entre 3 et 5 ans d'expérience")).toBe(1);
    expect(kept("Between 3 and 5 years of experience")).toBe(1);
    expect(kept("3/5 ans en agence")).toBe(1);
    expect(kept("Entre trois et cinq ans")).toBe(1);
  });

  // "Bac+5 et 3 ans" is the model error the check exists for: a degree's number is not years
  it("does not read a degree's number joined to a duration as years", () => {
    const offer = "Bac+5 et 3 ans d'expérience minimum. Master 2 et 5 ans en agence. Bac+3/5 ans.";
    const kept = (quote: string, minYears: number) =>
      normalizeJobRequirements([req({ label: "Expérience", kind: "experience_years", quote, minYears })], offer).length;
    expect(kept("Bac+5 et 3 ans d'expérience minimum", 5)).toBe(0);
    expect(kept("Bac+5 et 3 ans d'expérience minimum", 3)).toBe(1);
    expect(kept("Master 2 et 5 ans en agence", 2)).toBe(0);
    expect(kept("Bac+3/5 ans", 3)).toBe(0);
  });

  it("reads years written with a leading plus, and not the number of a licence or a master", () => {
    const offer = "+5 ans d'expérience. Licence 3 ou 2 ans en agence. M2 et 4 ans.";
    const kept = (quote: string, minYears: number) =>
      normalizeJobRequirements([req({ label: "Expérience", kind: "experience_years", quote, minYears })], offer).length;
    expect(kept("+5 ans d'expérience", 5)).toBe(1);
    expect(kept("Licence 3 ou 2 ans en agence", 3)).toBe(0);
    expect(kept("Licence 3 ou 2 ans en agence", 2)).toBe(1);
    expect(kept("M2 et 4 ans", 4)).toBe(1);
  });

  it("caps the list at 25 requirements", () => {
    const labels = Array.from({ length: 30 }, (_, i) => `Outil${i}`);
    const offer = `Outils : ${labels.join(", ")}.`;
    const many = labels.map(label => req({ label, quote: label }));
    expect(normalizeJobRequirements(many, offer)).toHaveLength(25);
  });

  it("finds a quote written with straight marks in an offer with typographic ones", () => {
    const offer = "Maîtrise de l’anglais indispensable.";
    const english = req({ label: "anglais", kind: "language", quote: "Maîtrise de l'anglais" });
    expect(normalizeJobRequirements([english], offer).map(r => r.id)).toEqual(["anglais"]);
  });

  // A real excerpt of the offer is not enough: the requirement must be the one
  // that excerpt states, or any label passes by quoting one word of the offer.
  it("drops a label that neither itself nor a variant appears in its own quote", () => {
    expect(normalizeJobRequirements([req({ label: "Kubernetes", quote: "maîtrise de Figma" })], OFFER)).toEqual([]);
    expect(normalizeJobRequirements([req({ label: "Maquettage", variants: ["Figma"], quote: "maîtrise de Figma" })], OFFER))
      .toHaveLength(1);
  });

  it("lets a job title or a degree be worded apart from its quote", () => {
    const offer = "Nous recrutons notre futur·e Product Designer. Bac+5 en design.";
    const out = normalizeJobRequirements([
      req({ label: "Designer produit", kind: "title", quote: "futur·e Product Designer" }),
      req({ label: "Master", kind: "education", quote: "Bac+5 en design" }),
    ], offer);
    expect(out.map(r => r.kind)).toEqual(["title", "education"]);
  });

  it("keeps C++, C# and C apart", () => {
    const offer = "Langages : C++, C# et C.";
    const out = normalizeJobRequirements([req({ label: "C++", quote: "C++" }), req({ label: "C#", quote: "C#" }), req({ label: "C", quote: "et C" })], offer);
    expect(new Set(out.map(r => r.id)).size).toBe(3);
  });

  it("keeps a label written in a non-Latin script", () => {
    const offer = "Требования: русский язык.";
    expect(normalizeJobRequirements([req({ label: "Русский язык", kind: "language", quote: "русский язык" })], offer)).toHaveLength(1);
  });

  it("reads null variants as none", () => {
    expect(normalizeJobRequirements([req({ variants: null })], OFFER)[0].variants).toEqual([]);
  });

  // Models write "minYears": null on requirements that are not years
  it("reads any null field as absent instead of dropping the requirement", () => {
    expect(normalizeJobRequirements([req({ minYears: null })], OFFER)).toHaveLength(1);
  });

  it("drops a quote found only inside a longer word of the offer", () => {
    expect(normalizeJobRequirements([req({ label: "Java", quote: "Java" })], "Stack : JavaScript, React.")).toEqual([]);
    expect(normalizeJobRequirements([req({ label: "R", quote: "R" })], "Stack : React.")).toEqual([]);
    expect(normalizeJobRequirements([req({ label: "Excel", quote: "Excel" })], "Excellent relationnel.")).toEqual([]);
  });

  it("drops a label found only inside a longer word of its quote", () => {
    const offer = "Excellent relationnel ; C++ avancé.";
    expect(normalizeJobRequirements([req({ label: "Excel", quote: "Excellent relationnel" })], offer)).toEqual([]);
    expect(normalizeJobRequirements([req({ label: "C", quote: "C++ avancé" })], offer)).toEqual([]);
  });

  it("keeps a label its quote states in a close form", () => {
    const offer = "Langages : C/C++. Conception d'API. Stack ASP.NET Core. Cinq ans d'expérience minimum.";
    const out = normalizeJobRequirements([
      req({ label: "C", quote: "C/C++" }),
      req({ label: "APIs", quote: "Conception d'API" }),
      req({ label: ".NET", quote: "ASP.NET Core" }),
      req({ label: "5 ans d'expérience", kind: "experience_years", quote: "Cinq ans d'expérience minimum", minYears: 5 }),
    ], offer);
    expect(out.map(r => r.label)).toEqual(["C", "APIs", ".NET", "5 ans d'expérience"]);
  });

  it("keeps two labels apart that differ only by a combining mark", () => {
    const offer = "Mots : バス、パス。";
    const out = normalizeJobRequirements([req({ label: "バス", quote: "バス" }), req({ label: "パス", quote: "パス" })], offer);
    expect(new Set(out.map(r => r.id)).size).toBe(2);
  });
});

describe("normalizeExperience: current role", () => {
  it("reads today written with any apostrophe as a current role", () => {
    const today = `aujourd${String.fromCodePoint(0x2018)}hui`;
    expect(normalizeExperience({ company: "A", position: "B", start_date: "2020", end_date: today }).current).toBe(true);
  });
});
