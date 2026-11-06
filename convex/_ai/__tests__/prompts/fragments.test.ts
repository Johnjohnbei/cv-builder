import { describe, it, expect } from "vitest";
import {
  FABRICATION_GUARD,
  ACTION_VERBS_FR,
  ACTION_VERBS_EN,
  KPI_RULES_FR,
  KPI_RULES_EN,
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
  // Seven verbs opened every bullet of a CV with the same three
  it("offers twenty verbs or more, and forbids two in a row", () => {
    expect(ACTION_VERBS_FR.split(",").length).toBeGreaterThanOrEqual(20);
    expect(ACTION_VERBS_FR).toContain("Piloté");
    expect(ACTION_VERBS_FR).toContain("Orchestré");
    expect(ACTION_VERBS_FR).toMatch(/jamais par le même verbe/i);
  });
  it("calls out weak verbs to avoid", () => {
    expect(ACTION_VERBS_FR).toContain("Responsable de");
  });
});

describe("ACTION_VERBS_EN", () => {
  it("offers twenty verbs or more, and forbids two in a row", () => {
    expect(ACTION_VERBS_EN.split(",").length).toBeGreaterThanOrEqual(20);
    expect(ACTION_VERBS_EN).toContain("Led");
    expect(ACTION_VERBS_EN).toContain("Orchestrated");
    expect(ACTION_VERBS_EN).toMatch(/never start with the same verb/i);
  });
  it("calls out weak verbs to avoid", () => {
    expect(ACTION_VERBS_EN).toContain("Responsible for");
  });
});

// Arbitrage Q2: a KPI the source does not give is an invention found out in an interview
describe("KPI_RULES", () => {
  it("keeps a KPI only from the source, left empty otherwise, never synthesized", () => {
    expect(KPI_RULES_FR.toLowerCase()).toContain("kpi");
    expect(KPI_RULES_FR).toContain("DURÉE");
    expect(KPI_RULES_FR).toMatch(/vide/);
    expect(KPI_RULES_FR).not.toMatch(/SYNTHÉTISE|OBLIGATOIRE/);
    expect(KPI_RULES_EN).toMatch(/empty/);
    expect(KPI_RULES_EN).not.toMatch(/SYNTHESIZE|MANDATORY/);
  });
});

// An intro made up "from position + company" repeats the two fields printed
// right above it: absent in the source, it stays absent
describe("INTRO_PRESERVATION", () => {
  it("keeps the intro the source gives, and forbids making one up", () => {
    expect(INTRO_PRESERVATION_FR.toLowerCase()).toContain("intro");
    expect(INTRO_PRESERVATION_FR).toMatch(/reste absent/);
    expect(INTRO_PRESERVATION_FR).not.toMatch(/synthétise/i);
    expect(INTRO_PRESERVATION_EN.toLowerCase()).toContain("intro");
    expect(INTRO_PRESERVATION_EN).toMatch(/stays missing/);
    expect(INTRO_PRESERVATION_EN).not.toMatch(/synthesize/i);
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
