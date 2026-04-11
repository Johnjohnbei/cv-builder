import { describe, it, expect } from "vitest";
import {
  CVDataSchema,
  ExperienceSchema,
  ATSAnalysisSchema,
  KeywordListSchema,
  BulletRewriteSchema,
  CoverLetterSchema,
  BulletSuggestionsSchema,
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
