import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeCVData,
  normalizeExperience,
  normalizeSkills,
  normalizeProficiency,
  normalizeTitle,
} from "../normalizers";
import cvClean from "./fixtures/cv-clean.json";
import cvDirty from "./fixtures/cv-dirty.json";
import cvLegacy from "./fixtures/cv-legacy-no-kpi.json";
import cvMalformed from "./fixtures/cv-malformed.json";

describe("normalizeProficiency", () => {
  // The backend no longer freezes proficiency to a localized string — it keeps
  // the RAW value so the render-side owner (formatting.ts) can localize FR↔EN.
  it("keeps the raw LinkedIn value (localization happens at render)", () => {
    expect(normalizeProficiency("Full Professional Proficiency")).toBe("Full Professional Proficiency");
  });
  it("keeps 'native or bilingual' raw", () => {
    expect(normalizeProficiency("native or bilingual")).toBe("native or bilingual");
  });
  it("trims surrounding whitespace", () => {
    expect(normalizeProficiency("  Elementary  ")).toBe("Elementary");
  });
  it("passes through arbitrary proficiencies unchanged", () => {
    expect(normalizeProficiency("Natif")).toBe("Natif");
  });
  it("returns empty string for undefined", () => {
    expect(normalizeProficiency(undefined)).toBe("");
  });
});

describe("normalizeTitle", () => {
  it("keeps short titles unchanged", () => {
    expect(normalizeTitle("Senior Designer")).toBe("Senior Designer");
  });
  it("truncates at | for long titles", () => {
    expect(
      normalizeTitle("Senior Designer | Product Manager | Growth Lead and more")
    ).toBe("Senior Designer");
  });
  it("truncates at , for long titles", () => {
    expect(
      normalizeTitle("Senior Product Designer, Leadership, Management, Coaching")
    ).toBe("Senior Product Designer");
  });
  it("returns undefined for undefined input", () => {
    expect(normalizeTitle(undefined)).toBeUndefined();
  });
});

describe("normalizeExperience", () => {
  it("coerces end_date='présent' to current=true and empties end_date", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", end_date: "présent",
      current: false, description: [],
    });
    expect(result.current).toBe(true);
    expect(result.end_date).toBe("");
  });

  it("coerces empty end_date to current=true", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", end_date: "",
      current: false, description: [],
    });
    expect(result.current).toBe(true);
  });

  it("defaults displayMode to 'normal' when missing", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
    });
    expect(result.displayMode).toBe("normal");
  });

  it("defaults displayMode to 'normal' when invalid", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
      displayMode: "super-ultra",
    });
    expect(result.displayMode).toBe("normal");
  });

  it("preserves valid displayMode", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
      displayMode: "extended",
    });
    expect(result.displayMode).toBe("extended");
  });

  it("trims kpi string", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
      kpi: "  35% growth  ",
    });
    expect(result.kpi).toBe("35% growth");
  });

  it("defaults kpi to empty string when missing", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
    });
    expect(result.kpi).toBe("");
  });

  it("caps description at 5 bullets", () => {
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false,
      description: ["1", "2", "3", "4", "5", "6", "7"],
    });
    expect(result.description).toHaveLength(5);
  });

  it("splits long bullet strings > 200 chars", () => {
    const longString =
      "Led the strategic initiative across multiple business units. Orchestrated cross-functional teams to drive digital transformation. Delivered results exceeding quarterly targets by significant margins. Established new operating procedures.";
    const result = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false,
      description: [longString],
    });
    expect(result.description.length).toBeGreaterThan(1);
  });

  it("passes showKpi boolean through", () => {
    const r1 = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
      showKpi: true,
    });
    expect(r1.showKpi).toBe(true);
    const r2 = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
      showKpi: false,
    });
    expect(r2.showKpi).toBe(false);
    const r3 = normalizeExperience({
      company: "A", position: "B", start_date: "2020", current: false, description: [],
    });
    expect(r3.showKpi).toBeUndefined();
  });
});

describe("normalizeSkills", () => {
  it("coerces object items to strings via .name", () => {
    const result = normalizeSkills([
      { category: "Tech", items: [{ name: "React" }, { skill: "TypeScript" }, "Plain"] },
    ]);
    expect(result[0].items).toContain("React");
    expect(result[0].items).toContain("TypeScript");
    expect(result[0].items).toContain("Plain");
  });

  it("dedupes items case-insensitively", () => {
    const result = normalizeSkills([
      { category: "Tech", items: ["React", "react", "REACT"] },
    ]);
    expect(result[0].items).toHaveLength(1);
  });

  it("caps items at 8 per category", () => {
    const result = normalizeSkills([
      { category: "Tech", items: Array.from({ length: 12 }, (_, i) => `Skill${i}`) },
    ]);
    expect(result[0].items).toHaveLength(8);
  });

  it("caps categories at 5", () => {
    const result = normalizeSkills(
      Array.from({ length: 8 }, (_, i) => ({ category: `Cat${i}`, items: ["a"] }))
    );
    expect(result).toHaveLength(5);
  });

  it("defaults category to 'Compétences' when missing", () => {
    const result = normalizeSkills([{ items: ["a"] }]);
    expect(result[0].category).toBe("Compétences");
  });
});

describe("normalizeCVData (top-level)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("normalizes a clean fixture end-to-end", () => {
    const result = normalizeCVData(cvClean);
    expect(result.personal_info.name).toBe("Jane Doe");
    expect(result.experience[0].displayMode).toBe("extended");
    expect(result.experience[0].kpi).toBe("Équipe de 8 designers encadrée");
  });

  it("normalizes a dirty fixture", () => {
    const result = normalizeCVData(cvDirty);
    expect(result.personal_info.title).toBe("Very Long Title With Many Words");
    // experience[0] end_date was "présent" -> coerced to current=true, end_date=""
    expect(result.experience[0].current).toBe(true);
    expect(result.experience[0].end_date).toBe("");
    expect(result.experience[0].kpi).toBe("35% growth");
    // Skill item coercion
    expect(result.skills[0].items).toContain("React");
    // Language proficiency kept RAW (localized at render, not frozen to French)
    expect(result.languages[0].proficiency).toBe("full professional proficiency");
  });

  it("handles legacy fixture without kpi/displayMode (defaults applied)", () => {
    const result = normalizeCVData(cvLegacy);
    expect(result.experience[0].displayMode).toBe("normal");
    expect(result.experience[0].kpi).toBe("");
    expect(result.experience[0].showKpi).toBeUndefined();
  });

  it("throws on malformed (non-object) input", () => {
    expect(() => normalizeCVData(cvMalformed)).toThrow(/CV invalide/);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns empty arrays for missing sections", () => {
    const result = normalizeCVData({ personal_info: { name: "X", email: "y@z.com" } });
    expect(result.experience).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.languages).toEqual([]);
  });
});
