import { describe, it, expect } from "vitest";
import {
  FABRICATION_GUARD,
  ACTION_VERBS_FR,
  ACTION_VERBS_EN,
  WEAK_VERBS_FR,
  WEAK_VERBS_EN,
  KPI_RULES_FR,
  INTRO_PRESERVATION_FR,
  INTRO_PRESERVATION_EN,
  LANGUAGE_OUTPUT_INSTRUCTION,
} from "../../prompts/fragments";

describe("FABRICATION_GUARD", () => {
  it("is non-empty and mentions 'ne jamais inventer'", () => {
    expect(FABRICATION_GUARD.length).toBeGreaterThan(50);
    expect(FABRICATION_GUARD.toLowerCase()).toContain("jamais inventer");
  });
});

describe("ACTION_VERBS_FR", () => {
  it("contains core strong verbs", () => {
    expect(ACTION_VERBS_FR).toContain("Pilote");
    expect(ACTION_VERBS_FR).toContain("Orchestre");
    expect(ACTION_VERBS_FR).toContain("Optimise");
  });
  it("calls out weak verbs to avoid", () => {
    expect(ACTION_VERBS_FR).toContain("Responsable de");
  });
});

describe("ACTION_VERBS_EN", () => {
  it("contains core strong verbs", () => {
    expect(ACTION_VERBS_EN).toContain("Led");
    expect(ACTION_VERBS_EN).toContain("Orchestrated");
  });
  it("calls out weak verbs to avoid", () => {
    expect(ACTION_VERBS_EN).toContain("Responsible for");
  });
});

describe("KPI_RULES_FR", () => {
  it("mentions 'kpi' and calibration rules", () => {
    expect(KPI_RULES_FR.toLowerCase()).toContain("kpi");
    expect(KPI_RULES_FR).toContain("DURÉE");
    expect(KPI_RULES_FR).toContain("OBLIGATOIRE");
  });
});

describe("INTRO_PRESERVATION", () => {
  it("FR version mentions intro", () => {
    expect(INTRO_PRESERVATION_FR.toLowerCase()).toContain("intro");
    expect(INTRO_PRESERVATION_FR.toLowerCase()).toContain("préservé");
  });
  it("EN version mentions intro", () => {
    expect(INTRO_PRESERVATION_EN.toLowerCase()).toContain("intro");
    expect(INTRO_PRESERVATION_EN.toLowerCase()).toContain("preserved");
  });
});

describe("LANGUAGE_OUTPUT_INSTRUCTION", () => {
  it("returns English instruction when isEn=true", () => {
    expect(LANGUAGE_OUTPUT_INSTRUCTION(true)).toContain("English");
  });
  it("returns French instruction when isEn=false", () => {
    expect(LANGUAGE_OUTPUT_INSTRUCTION(false)).toContain("français");
  });
});

describe("WEAK_VERBS", () => {
  it("FR list is non-empty", () => {
    expect(WEAK_VERBS_FR.length).toBeGreaterThan(10);
  });
  it("EN list is non-empty", () => {
    expect(WEAK_VERBS_EN.length).toBeGreaterThan(10);
  });
});
