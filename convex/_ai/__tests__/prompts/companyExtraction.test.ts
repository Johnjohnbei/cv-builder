import { describe, it, expect } from "vitest";
import { buildCompanyExtractionPrompt } from "../../prompts/companyExtraction";

describe("buildCompanyExtractionPrompt", () => {
  it("embeds the job description verbatim", () => {
    const jd = "We are hiring a senior frontend developer at Acme Corp in Paris.";
    const prompt = buildCompanyExtractionPrompt({ jobDescription: jd });
    expect(prompt).toContain(jd);
  });

  it("requests the three output fields", () => {
    const prompt = buildCompanyExtractionPrompt({ jobDescription: "x" });
    expect(prompt).toContain("companyName");
    expect(prompt).toContain("domainGuess");
    expect(prompt).toContain("industry");
  });

  it("instructs JSON-only output", () => {
    const prompt = buildCompanyExtractionPrompt({ jobDescription: "x" });
    expect(prompt).toContain("Retourne UNIQUEMENT le JSON");
  });

  it("forbids generic fallbacks in FR", () => {
    const prompt = buildCompanyExtractionPrompt({ jobDescription: "x" });
    expect(prompt).toContain("null");
    expect(prompt).toContain("notre client");
    expect(prompt).toContain("l'entreprise");
  });

  it("forbids generic fallbacks in EN", () => {
    const prompt = buildCompanyExtractionPrompt({ jobDescription: "x" });
    expect(prompt).toContain("the company");
    expect(prompt).toContain("our client");
  });

  it("forbids hallucination with high-confidence rule", () => {
    const prompt = buildCompanyExtractionPrompt({ jobDescription: "x" });
    expect(prompt).toContain("null");
    expect(prompt.toLowerCase()).toContain("high confidence");
  });

  it("handles a French JD with a clear company mention", () => {
    const jd =
      "Société Générale recherche un développeur senior pour rejoindre son équipe à La Défense.";
    const prompt = buildCompanyExtractionPrompt({ jobDescription: jd });
    expect(prompt).toContain("Société Générale");
  });

  it("handles an English JD with a clear company mention", () => {
    const jd = "Airbus is looking for a senior data engineer to join our Toulouse team.";
    const prompt = buildCompanyExtractionPrompt({ jobDescription: jd });
    expect(prompt).toContain("Airbus");
  });
});
