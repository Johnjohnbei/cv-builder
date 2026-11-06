import { describe, it, expect } from "vitest";
import { buildExtractPrompt } from "../../prompts/extract";
import { KPI_RULES_FR } from "../../prompts/fragments";

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

// The import used to demand a KPI "MANDATORY, never empty, synthesize it from
// the context": the figures it made up then became the source of truth the
// tailoring's guard protects
describe("buildExtractPrompt: extracting is not writing", () => {
  const prompt = buildExtractPrompt({ pdfText: "x" });

  it("never asks for a KPI to be synthesized, and leaves it empty when absent", () => {
    expect(prompt).not.toMatch(/synth[ée]tise-le/i);
    expect(prompt).not.toMatch(/OBLIGATOIRE, jamais vide/);
    expect(prompt).toMatch(/laisse "kpi" vide/);
  });

  it("carries the one owner of the KPI rules, not a second copy", () => {
    expect(prompt).toContain(KPI_RULES_FR);
  });

  it("leaves an absent intro absent instead of deducing it from the job title", () => {
    expect(prompt).toMatch(/reste vide/);
    expect(prompt).not.toMatch(/Toujours présent/);
  });
});
