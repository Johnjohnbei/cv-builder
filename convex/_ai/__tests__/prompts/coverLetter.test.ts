import { describe, it, expect } from "vitest";
import { buildCoverLetterPrompt } from "../../prompts/coverLetter";

const SAMPLE_CV = {
  personal_info: { name: "Jane Doe" },
  experience: [],
};

describe("buildCoverLetterPrompt", () => {
  it("embeds CV and job description", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "Senior Designer role",
    });
    expect(prompt).toContain("Jane Doe");
    expect(prompt).toContain("Senior Designer role");
  });

  it("applies default tone when not provided", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
    });
    expect(prompt).toContain("professionnel et engagé");
  });

  it("uses custom tone when provided", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
      tone: "formel et mesuré",
    });
    expect(prompt).toContain("formel et mesuré");
  });

  it("includes company clause when companyName provided", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
      companyName: "Acme Corp",
    });
    expect(prompt).toContain("pour l'entreprise Acme Corp");
  });

  it("omits company clause when companyName missing", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
    });
    expect(prompt).not.toContain("pour l'entreprise");
  });

  it("mentions all four output fields and JSON-only instruction", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
    });
    expect(prompt).toContain("subject");
    expect(prompt).toContain("greeting");
    expect(prompt).toContain("body");
    expect(prompt).toContain("closing");
    expect(prompt).toContain("Retourne UNIQUEMENT le JSON");
  });
});
