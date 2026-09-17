import { describe, it, expect } from "vitest";
import { buildAdaptPrompt, buildEvidencePrompt } from "../../prompts/adapt";
import { FABRICATION_GUARD, KPI_RULES_EN, KPI_RULES_FR } from "../../prompts/fragments";
import type { JobRequirement } from "../../../../src/shared/types";

const CV = { personal_info: { name: "Jane" }, experience: [], skills: [] };
const REQUIREMENTS: JobRequirement[] = [
  { id: "figma", label: "Figma", variants: [], kind: "tool", importance: "required", quote: "Figma" },
  { id: "recherche-utilisateur", label: "recherche utilisateur", variants: ["user research"], kind: "method", importance: "preferred", quote: "recherche utilisateur" },
];
const prompt = (over: Partial<Parameters<typeof buildAdaptPrompt>[0]> = {}) =>
  buildAdaptPrompt({ cvData: CV, jobDescription: "Poste de Product Designer à Paris", requirements: REQUIREMENTS, ...over });

describe("buildAdaptPrompt", () => {
  it("embeds the CV and the offer", () => {
    expect(prompt()).toContain("Jane");
    expect(prompt()).toContain("Poste de Product Designer à Paris");
  });

  it("lists every requirement with its id, exact label, kind and importance", () => {
    expect(prompt()).toContain("figma | Figma | tool | required");
    expect(prompt()).toContain("recherche-utilisateur | recherche utilisateur | method | preferred");
  });

  // The server keeps a placed requirement only with a quote of the source CV proving it
  it("asks for the source quote proving each requirement placed, and places none without one", () => {
    expect(prompt()).toContain('"evidence"');
    expect(prompt()).toContain('"quote"');
    expect(prompt()).toMatch(/sans preuve/i);
  });

  it("keeps the experiences in order with their companies and dates, and bounds keyword stuffing", () => {
    expect(prompt()).toMatch(/même ordre/);
    expect(prompt()).toMatch(/dates/);
    expect(prompt()).toContain("2 exigences");
    expect(prompt()).toContain("3 fois");
  });

  it("writes a KPI only when the source gives one", () => {
    expect(prompt()).toContain(KPI_RULES_FR);
    expect(prompt({ jobDescription: "Responsibilities include managing requirements and skills" })).toContain(KPI_RULES_EN);
  });

  it("carries the fabrication guard, the page budget and the company tags, and forbids displayMode", () => {
    expect(prompt()).toContain(FABRICATION_GUARD);
    expect(prompt({ pageLimit: 1 })).toContain("1 page(s) A4");
    expect(prompt()).toContain("companyStage");
    expect(prompt()).toMatch(/JAMAIS "displayMode"/);
  });

  it("writes in the offer's language, the override when the offer is too short to tell", () => {
    expect(prompt()).toContain("VERROU DE LANGUE");
    expect(prompt({ jobDescription: "Responsibilities include managing requirements and skills" })).toContain("LANGUAGE LOCK");
    expect(prompt({ languageOverride: "en" })).toContain("VERROU DE LANGUE");
    expect(prompt({ jobDescription: "Designer", languageOverride: "en" })).toContain("100% ENGLISH");
  });

  it("ends with the JSON-only instruction", () => {
    expect(prompt().trim().endsWith("Retourne UNIQUEMENT l'objet JSON.")).toBe(true);
  });

  it("names the quote already found for a requirement, and leaves the others bare", () => {
    const withQuote = prompt({ quotes: new Map([["recherche-utilisateur", 'Mené 30 "entretiens"']]) });
    expect(withQuote).toContain("recherche-utilisateur | recherche utilisateur | method | preferred | prouvée par : Mené 30 entretiens");
    expect(withQuote).toContain("figma | Figma | tool | required\n");
  });

  it("gives no proof block when the candidate gave none", () => {
    expect(prompt()).not.toContain("PREUVES DU CANDIDAT");
    expect(prompt({ proofs: new Map([["figma", "Maquettes Figma chez Acme"]]) })).toContain("- figma | Figma | Maquettes Figma chez Acme");
  });
});

describe("buildEvidencePrompt", () => {
  const evidence = buildEvidencePrompt({ cvData: CV, requirements: REQUIREMENTS });

  it("lists each requirement with every spelling it may take, and the CV", () => {
    expect(evidence).toContain("- recherche-utilisateur | recherche utilisateur / user research");
    expect(evidence).toContain('"name":"Jane"');
  });

  // The code keeps a quote only when it is words of the CV and one of the requirement's own words
  it("asks for verbatim quotes carrying a word of the requirement's own", () => {
    expect(evidence).toContain("MOT POUR MOT");
    expect(evidence).toContain("un mot propre à cette exigence");
    expect(evidence).toContain('"evidence"');
  });
});
