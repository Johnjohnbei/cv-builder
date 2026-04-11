import { describe, it, expect } from "vitest";
import { buildATSAnalysisPrompt } from "../../prompts/analysis";

const SAMPLE_CV = {
  personal_info: { name: "Jane", email: "jane@example.com" },
  experience: [],
  skills: [],
};

describe("buildATSAnalysisPrompt", () => {
  it("embeds the CV JSON and the job description", () => {
    const prompt = buildATSAnalysisPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "Senior Designer role in Paris",
    });
    expect(prompt).toContain("Jane");
    expect(prompt).toContain("Senior Designer role in Paris");
  });

  it("mentions every required output field", () => {
    const prompt = buildATSAnalysisPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
    });
    expect(prompt).toContain("score");
    expect(prompt).toContain("missingKeywords");
    expect(prompt).toContain("strengths");
    expect(prompt).toContain("improvements");
    expect(prompt).toContain("ats_compatibility");
  });

  it("lists the ats_compatibility enum values", () => {
    const prompt = buildATSAnalysisPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
    });
    expect(prompt).toContain("LOW");
    expect(prompt).toContain("MEDIUM");
    expect(prompt).toContain("HIGH");
  });

  it("ends with the JSON-only instruction", () => {
    const prompt = buildATSAnalysisPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
    });
    expect(prompt).toContain("Retourne UNIQUEMENT le JSON");
  });
});
