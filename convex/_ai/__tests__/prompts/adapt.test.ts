import { describe, it, expect } from "vitest";
import { buildAdaptPrompt } from "../../prompts/adapt";
import { FABRICATION_GUARD } from "../../prompts/fragments";

const SAMPLE_CV = { personal_info: { name: "Jane" }, experience: [], skills: [] };

describe("buildAdaptPrompt — tailor mode", () => {
  it("embeds CV JSON and job description", () => {
    const prompt = buildAdaptPrompt({
      mode: "tailor",
      cvData: SAMPLE_CV,
      jobDescription: "Senior Designer with React experience",
    });
    expect(prompt).toContain("Jane");
    expect(prompt).toContain("Senior Designer with React experience");
  });

  it("defaults to French language", () => {
    const prompt = buildAdaptPrompt({
      mode: "tailor",
      cvData: SAMPLE_CV,
      jobDescription: "Poste en France",
    });
    expect(prompt).toContain("français");
  });

  it("switches to English when JD contains English keywords", () => {
    const prompt = buildAdaptPrompt({
      mode: "tailor",
      cvData: SAMPLE_CV,
      jobDescription: "Responsibilities include managing requirements and skills",
    });
    expect(prompt).toContain("English");
  });

  it("respects explicit languageOverride='en'", () => {
    const prompt = buildAdaptPrompt({
      mode: "tailor",
      cvData: SAMPLE_CV,
      jobDescription: "Poste à Paris",
      languageOverride: "en",
    });
    expect(prompt).toContain("English");
  });

  it("contains fabrication guard and KPI rules", () => {
    const prompt = buildAdaptPrompt({
      mode: "tailor",
      cvData: SAMPLE_CV,
      jobDescription: "x",
    });
    expect(prompt).toContain(FABRICATION_GUARD);
    expect(prompt).toContain("KPI");
  });

  it("ends with JSON-only instruction", () => {
    const prompt = buildAdaptPrompt({
      mode: "tailor",
      cvData: SAMPLE_CV,
      jobDescription: "x",
    });
    expect(prompt.trim().endsWith("Return ONLY the optimized CV JSON.")).toBe(true);
  });
});

describe("buildAdaptPrompt — language purity (anti-mix)", () => {
  it("EN mode uses English KPI examples, not French ones", () => {
    const prompt = buildAdaptPrompt({
      mode: "tailor",
      cvData: SAMPLE_CV,
      jobDescription: "Senior Product Manager, requirements and stakeholders",
      languageOverride: "en",
    });
    expect(prompt).toContain("Led a team of 8 designers");
    expect(prompt).not.toContain("Équipe de 8 designers encadrée");
  });

  it("FR mode keeps French KPI examples", () => {
    const prompt = buildAdaptPrompt({
      mode: "tailor",
      cvData: SAMPLE_CV,
      jobDescription: "Poste de chef de produit à Paris",
      languageOverride: "fr",
    });
    expect(prompt).toContain("Équipe de 8 designers encadrée");
  });

  it("EN mode includes the anti-mix language lock", () => {
    const prompt = buildAdaptPrompt({
      mode: "optimize",
      cvData: SAMPLE_CV,
      pageLimit: 2,
      languageOverride: "en",
    });
    expect(prompt).toContain("LANGUAGE LOCK");
    expect(prompt).toContain("100% ENGLISH");
  });

  it("FR mode includes the French language lock", () => {
    const prompt = buildAdaptPrompt({
      mode: "optimize",
      cvData: SAMPLE_CV,
      pageLimit: 2,
      languageOverride: "fr",
    });
    expect(prompt).toContain("VERROU DE LANGUE");
  });
});

describe("buildAdaptPrompt — optimize mode", () => {
  it("includes pageLimit in the constraint block", () => {
    const prompt = buildAdaptPrompt({
      mode: "optimize",
      cvData: SAMPLE_CV,
      pageLimit: 1,
    });
    expect(prompt).toContain("1 A4 page(s)");
  });

  it("handles missing JD with recency prioritization", () => {
    const prompt = buildAdaptPrompt({
      mode: "optimize",
      cvData: SAMPLE_CV,
      pageLimit: 2,
    });
    expect(prompt).toContain("RECENCY");
  });

  it("describes the displayMode system", () => {
    const prompt = buildAdaptPrompt({
      mode: "optimize",
      cvData: SAMPLE_CV,
      pageLimit: 2,
    });
    expect(prompt).toContain("displayMode");
    expect(prompt).toContain("extended");
    expect(prompt).toContain("compact");
  });
});
