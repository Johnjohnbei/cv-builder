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
