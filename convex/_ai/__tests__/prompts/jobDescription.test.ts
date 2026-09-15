import { describe, it, expect } from "vitest";
import {
  buildJobDescriptionFromURLPrompt,
  buildJobDescriptionFromPDFPrompt,
  buildJobRequirementsPrompt,
} from "../../prompts/jobDescription";

describe("buildJobDescriptionFromURLPrompt", () => {
  it("embeds the URL and page text", () => {
    const prompt = buildJobDescriptionFromURLPrompt({
      url: "https://example.com/job",
      pageText: "Senior Designer at Acme",
    });
    expect(prompt).toContain("https://example.com/job");
    expect(prompt).toContain("Senior Designer at Acme");
  });

  it("asks for structured fields", () => {
    const prompt = buildJobDescriptionFromURLPrompt({ url: "x", pageText: "y" });
    expect(prompt).toContain("Titre du poste");
    expect(prompt).toContain("Missions");
  });
});

describe("buildJobDescriptionFromPDFPrompt", () => {
  it("embeds the pdfText", () => {
    const prompt = buildJobDescriptionFromPDFPrompt({ pdfText: "Job description content" });
    expect(prompt).toContain("Job description content");
  });

  it("mentions fiche de poste", () => {
    const prompt = buildJobDescriptionFromPDFPrompt({ pdfText: "x" });
    expect(prompt).toContain("fiche de poste");
  });
});

describe("buildJobRequirementsPrompt", () => {
  const prompt = buildJobRequirementsPrompt({ jobDescription: "Product Designer Senior, Figma requis" });

  it("embeds the job description", () => {
    expect(prompt).toContain("Product Designer Senior, Figma requis");
  });

  // What recruiters filter on first was missing from the keyword list:
  // job title, years of experience, degree, languages.
  it("asks for every kind of requirement a recruiter filters on", () => {
    for (const kind of ["title", "hard_skill", "tool", "method", "certification", "domain", "language", "education", "experience_years", "soft_skill"]) {
      expect(prompt).toContain(kind);
    }
  });

  it("asks for importance, variants and the exact quote of the offer", () => {
    expect(prompt).toContain('"importance"');
    expect(prompt).toContain('"variants"');
    expect(prompt).toContain('"quote"');
    expect(prompt).toContain('"minYears"');
  });

  it("excludes benefits, company presentation and hiring process", () => {
    expect(prompt).toMatch(/avantages/i);
    expect(prompt).toMatch(/présentation de l'entreprise/i);
    expect(prompt).toMatch(/processus de recrutement/i);
  });

  it("asks for requirements JSON only", () => {
    expect(prompt).toContain('"requirements"');
    expect(prompt).toContain("Retourne UNIQUEMENT le JSON");
  });
});
