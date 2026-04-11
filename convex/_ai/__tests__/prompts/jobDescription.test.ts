import { describe, it, expect } from "vitest";
import {
  buildJobDescriptionFromURLPrompt,
  buildJobDescriptionFromPDFPrompt,
  buildJobKeywordsPrompt,
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

describe("buildJobKeywordsPrompt", () => {
  it("embeds the job description", () => {
    const prompt = buildJobKeywordsPrompt({ jobDescription: "Senior Designer role" });
    expect(prompt).toContain("Senior Designer role");
  });

  it("asks for keywords JSON output", () => {
    const prompt = buildJobKeywordsPrompt({ jobDescription: "x" });
    expect(prompt).toContain("keywords");
    expect(prompt).toContain("Retourne UNIQUEMENT le JSON");
  });

  it("excludes generic terms explicitly", () => {
    const prompt = buildJobKeywordsPrompt({ jobDescription: "x" });
    expect(prompt).toContain("N'extrais JAMAIS");
  });
});
