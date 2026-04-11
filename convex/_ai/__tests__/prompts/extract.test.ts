import { describe, it, expect } from "vitest";
import { buildExtractPrompt } from "../../prompts/extract";

describe("buildExtractPrompt", () => {
  it("embeds the pdfText verbatim", () => {
    const prompt = buildExtractPrompt({ pdfText: "John Smith\nSoftware Engineer" });
    expect(prompt).toContain("John Smith");
    expect(prompt).toContain("Software Engineer");
  });

  it("contains the TEXTE DU CV anchor", () => {
    const prompt = buildExtractPrompt({ pdfText: "content" });
    expect(prompt).toContain("TEXTE DU CV");
  });

  it("contains kpi and date formatting rules", () => {
    const prompt = buildExtractPrompt({ pdfText: "x" });
    expect(prompt.toLowerCase()).toContain("kpi");
    expect(prompt).toContain("Mois YYYY");
  });

  it("contains proficiency standards and final JSON-only instruction", () => {
    const prompt = buildExtractPrompt({ pdfText: "x" });
    expect(prompt).toContain("Natif");
    expect(prompt).toContain("Courant (C1)");
    expect(prompt).toContain("Retourne UNIQUEMENT le JSON");
  });

  it("safely handles empty pdfText", () => {
    const prompt = buildExtractPrompt({ pdfText: "" });
    expect(prompt.length).toBeGreaterThan(100);
  });
});
