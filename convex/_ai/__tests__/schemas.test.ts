import { describe, it, expect } from "vitest";
import {
  CVDataSchema,
  ExperienceSchema,
  ATSAnalysisSchema,
  KeywordListSchema,
  BulletRewriteSchema,
  CoverLetterSchema,
  BulletSuggestionsSchema,
  CompanyMetaSchema,
  KeywordAssignmentSchema,
} from "../schemas";
import cvClean from "./fixtures/cv-clean.json";
import cvDirty from "./fixtures/cv-dirty.json";
import cvLegacy from "./fixtures/cv-legacy-no-kpi.json";

describe("CVDataSchema", () => {
  it("parses a clean fixture", () => {
    const result = CVDataSchema.parse(cvClean);
    expect(result.personal_info.name).toBe("Jane Doe");
    expect(result.experience).toHaveLength(1);
    expect(result.skills).toHaveLength(1);
  });

  it("parses a dirty fixture via passthrough", () => {
    const result = CVDataSchema.parse(cvDirty);
    expect((result as any).unknown_field).toBe("should be preserved by passthrough");
    expect(result.experience).toHaveLength(2);
  });

  it("parses a legacy fixture without kpi/showKpi/displayMode", () => {
    const result = CVDataSchema.parse(cvLegacy);
    expect(result.experience[0].kpi).toBeUndefined();
    expect(result.experience[0].displayMode).toBeUndefined();
  });

  it("applies defaults on empty input", () => {
    const result = CVDataSchema.parse({});
    expect(result.experience).toEqual([]);
    expect(result.education).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.languages).toEqual([]);
  });

  it("applies default email when personal_info is minimal", () => {
    const result = CVDataSchema.parse({ personal_info: { name: "X" } });
    expect(result.personal_info.email).toBe("");
  });
});

describe("ExperienceSchema", () => {
  it("allows displayMode omitted", () => {
    const result = ExperienceSchema.parse({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
    });
    expect(result.displayMode).toBeUndefined();
  });

  it("rejects displayMode not in enum", () => {
    expect(() =>
      ExperienceSchema.parse({
        company: "A", position: "B", start_date: "2020", current: false, description: [],
        displayMode: "weird",
      })
    ).toThrow();
  });
});

describe("ATSAnalysisSchema", () => {
  it("parses valid analysis", () => {
    const result = ATSAnalysisSchema.parse({
      score: 85, missingKeywords: ["Figma"], strengths: ["UX"], improvements: ["metrics"],
      ats_compatibility: "HIGH",
    });
    expect(result.score).toBe(85);
  });

  it("rejects invalid ats_compatibility", () => {
    expect(() => ATSAnalysisSchema.parse({ score: 50, ats_compatibility: "BAD" })).toThrow();
  });

  it("rejects missing score", () => {
    expect(() => ATSAnalysisSchema.parse({ ats_compatibility: "LOW" })).toThrow();
  });
});

describe("Ancillary schemas", () => {
  it("KeywordListSchema parses keywords array", () => {
    const result = KeywordListSchema.parse({ keywords: ["a", "b"] });
    expect(result.keywords).toEqual(["a", "b"]);
  });

  it("BulletRewriteSchema parses rewrites", () => {
    const result = BulletRewriteSchema.parse({
      rewrites: [{ index: 0, original: "x", rewritten: "y" }],
    });
    expect(result.rewrites).toHaveLength(1);
  });

  it("CoverLetterSchema parses letter fields", () => {
    const result = CoverLetterSchema.parse({
      subject: "s", greeting: "g", body: "b", closing: "c",
    });
    expect(result.body).toBe("b");
  });

  it("BulletSuggestionsSchema parses 3 suggestions", () => {
    const result = BulletSuggestionsSchema.parse({
      suggestions: ["a", "b", "c"],
    });
    expect(result.suggestions).toHaveLength(3);
  });
});

describe("CompanyMetaSchema", () => {
  it("parses valid payload with all fields as strings", () => {
    const result = CompanyMetaSchema.parse({
      companyName: "Google",
      domainGuess: "google.com",
      industry: "Tech",
    });
    expect(result.companyName).toBe("Google");
    expect(result.domainGuess).toBe("google.com");
    expect(result.industry).toBe("Tech");
  });

  it("parses valid payload with all fields as null", () => {
    const result = CompanyMetaSchema.parse({
      companyName: null,
      domainGuess: null,
      industry: null,
    });
    expect(result.companyName).toBeNull();
    expect(result.domainGuess).toBeNull();
    expect(result.industry).toBeNull();
  });

  it("parses mixed payload (name string, others null)", () => {
    const result = CompanyMetaSchema.parse({
      companyName: "Airbus",
      domainGuess: null,
      industry: null,
    });
    expect(result.companyName).toBe("Airbus");
    expect(result.domainGuess).toBeNull();
    expect(result.industry).toBeNull();
  });

  it("rejects when companyName is a number", () => {
    expect(() =>
      CompanyMetaSchema.parse({
        companyName: 42,
        domainGuess: null,
        industry: null,
      })
    ).toThrow();
  });

  it("preserves unknown fields via passthrough", () => {
    const result = CompanyMetaSchema.parse({
      companyName: "Acme",
      domainGuess: null,
      industry: null,
      extraField: "keep me",
    });
    expect((result as any).extraField).toBe("keep me");
  });
});

describe("ATSAnalysisSchema — career-ops fields", () => {
  const BASE = {
    score: 75,
    missingKeywords: [],
    strengths: [],
    improvements: [],
    ats_compatibility: "MEDIUM" as const,
  };

  it("accepts seniority_match when provided with a valid enum value", () => {
    const result = ATSAnalysisSchema.parse({ ...BASE, seniority_match: "MATCH" });
    expect(result.seniority_match).toBe("MATCH");
  });

  it("accepts compensation_estimate as a string", () => {
    const result = ATSAnalysisSchema.parse({ ...BASE, compensation_estimate: "45k-65k€" });
    expect(result.compensation_estimate).toBe("45k-65k€");
  });

  it("accepts compensation_estimate as null", () => {
    const result = ATSAnalysisSchema.parse({ ...BASE, compensation_estimate: null });
    expect(result.compensation_estimate).toBeNull();
  });

  it("still parses when both new fields are absent (backward compat)", () => {
    const result = ATSAnalysisSchema.parse(BASE);
    expect(result.seniority_match).toBeUndefined();
    expect(result.compensation_estimate).toBeUndefined();
  });

  it("rejects seniority_match outside the enum (e.g. JUNIOR)", () => {
    const parsed = ATSAnalysisSchema.safeParse({ ...BASE, seniority_match: "JUNIOR" });
    expect(parsed.success).toBe(false);
  });
});

describe("KeywordAssignmentSchema — target field", () => {
  it("accepts a valid target value (summary|experience|skills)", () => {
    const result = KeywordAssignmentSchema.parse({
      keyword: "Figma",
      expIndex: 0,
      target: "summary",
    });
    expect(result.target).toBe("summary");
  });

  it("still parses assignments without a target field (existing shape)", () => {
    const result = KeywordAssignmentSchema.parse({
      keyword: "Figma",
      expIndex: 0,
    });
    expect(result.target).toBeUndefined();
  });

  it("rejects target outside the enum (e.g. cover_letter)", () => {
    const parsed = KeywordAssignmentSchema.safeParse({
      keyword: "Figma",
      expIndex: 0,
      target: "cover_letter",
    });
    expect(parsed.success).toBe(false);
  });
});
