import { describe, it, expect } from "vitest";
import { buildRepairPrompt } from "../../prompts/distribute";
import { FABRICATION_GUARD } from "../../prompts/fragments";
import { RepairSchema } from "../../schemas";

const CTX = {
  cv: {
    personal_info: { summary: "Designer produit en SaaS." },
    experience: [{ position: "Senior Designer", company: "Acme", description: ["Pilote la refonte", "Mène les entretiens"] }],
    skills: [{ category: "Outils", items: ["Sketch"] }],
  },
  missing: [{ label: "Figma", evidence: "Maquettes sous Figma" }, { label: "recherche utilisateur" }],
  language: "fr" as const,
};

describe("buildRepairPrompt", () => {
  it("indexes the experiences and their bullets, with the summary and the skills", () => {
    const prompt = buildRepairPrompt(CTX);
    expect(prompt).toContain("[0] Senior Designer @ Acme");
    expect(prompt).toContain("- [1] Mène les entretiens");
    expect(prompt).toContain("Designer produit en SaaS.");
    expect(prompt).toContain("Sketch");
  });

  it("lists each missing requirement in its exact form, with the proof the source gives", () => {
    const prompt = buildRepairPrompt(CTX);
    // The quote is written as data: its own quotes would close the block it sits in
    expect(prompt).toContain('"Figma" (preuve : Maquettes sous Figma)');
    expect(prompt).toContain('"recherche utilisateur"');
  });

  it("carries the fabrication guard and the stuffing bound", () => {
    const prompt = buildRepairPrompt(CTX);
    expect(prompt).toContain(FABRICATION_GUARD);
    expect(prompt).toContain("2 exigences");
  });

  it("locks the language of the CV and ends with the JSON-only instruction", () => {
    expect(buildRepairPrompt({ ...CTX, language: "en" })).toContain("LANGUAGE LOCK");
    expect(buildRepairPrompt(CTX).trim().endsWith("Retourne UNIQUEMENT le JSON.")).toBe(true);
  });
});

describe("RepairSchema", () => {
  it("parses edits, a missing index included", () => {
    const result = RepairSchema.parse({
      edits: [
        { target: "experience", expIndex: 0, bulletIndex: 1, text: "Mène la recherche utilisateur" },
        { target: "skills", text: "Figma" },
      ],
    });
    expect(result.edits).toHaveLength(2);
  });

  it("reads no edits as none, and refuses an unknown target", () => {
    expect(RepairSchema.parse({}).edits).toEqual([]);
    expect(RepairSchema.safeParse({ edits: [{ target: "cover_letter", text: "x" }] }).success).toBe(false);
  });
});
