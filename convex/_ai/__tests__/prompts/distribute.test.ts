import { describe, it, expect } from "vitest";
import { buildKeywordDistributionPrompt } from "../../prompts/distribute";
import { FABRICATION_GUARD, ACTION_VERBS_FR } from "../../prompts/fragments";
import {
  KeywordDistributionSchema,
  KeywordAssignmentSchema,
} from "../../schemas";

const SAMPLE_CTX = {
  cvData: {
    experience: [
      {
        position: "Senior Designer",
        company: "Acme",
        intro: "Leads the design system",
        description: ["Pilote la refonte", "Gère l'équipe"],
        kpi: "Équipe de 8",
      },
    ],
  },
  missingKeywords: ["Figma", "Design System"],
  jobDescription: "Need a senior designer with Figma and design system experience",
};

describe("buildKeywordDistributionPrompt", () => {
  it("embeds the experience summary with position + company + bullets", () => {
    const prompt = buildKeywordDistributionPrompt(SAMPLE_CTX);
    expect(prompt).toContain("Senior Designer");
    expect(prompt).toContain("Acme");
    expect(prompt).toContain("Pilote la refonte");
  });

  it("lists every missing keyword", () => {
    const prompt = buildKeywordDistributionPrompt(SAMPLE_CTX);
    expect(prompt).toContain("- Figma");
    expect(prompt).toContain("- Design System");
  });

  it("embeds the job description", () => {
    const prompt = buildKeywordDistributionPrompt(SAMPLE_CTX);
    expect(prompt).toContain("Need a senior designer with Figma");
  });

  it("contains FABRICATION_GUARD, ACTION_VERBS_FR, and the JSON-only instruction", () => {
    const prompt = buildKeywordDistributionPrompt(SAMPLE_CTX);
    expect(prompt).toContain(FABRICATION_GUARD);
    expect(prompt).toContain(ACTION_VERBS_FR);
    expect(prompt).toContain("Retourne UNIQUEMENT le JSON");
  });
});

describe("KeywordDistributionSchema", () => {
  it("parses a valid distribution response", () => {
    const result = KeywordDistributionSchema.parse({
      assignments: [
        {
          keyword: "Figma",
          expIndex: 0,
          bulletIndex: 1,
          originalBullet: "Pilote la refonte",
          rewrittenBullet: "Pilote la refonte avec Figma",
          reason: "Contexte cohérent",
        },
      ],
    });
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].keyword).toBe("Figma");
  });

  it("accepts null expIndex (unassigned)", () => {
    const result = KeywordDistributionSchema.parse({
      assignments: [
        {
          keyword: "Kubernetes",
          expIndex: null,
          reason: "Aucune expérience crédible",
        },
      ],
    });
    expect(result.assignments[0].expIndex).toBeNull();
  });

  it("defaults missing assignments array to []", () => {
    const result = KeywordDistributionSchema.parse({});
    expect(result.assignments).toEqual([]);
  });

  it("rejects assignment without keyword field", () => {
    expect(() =>
      KeywordAssignmentSchema.parse({ expIndex: 0 })
    ).toThrow();
  });
});
