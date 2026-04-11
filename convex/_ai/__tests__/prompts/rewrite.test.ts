import { describe, it, expect } from "vitest";
import {
  buildBulletSuggestionsPrompt,
  buildBulletRewritePrompt,
} from "../../prompts/rewrite";
import { FABRICATION_GUARD } from "../../prompts/fragments";

describe("buildBulletSuggestionsPrompt", () => {
  it("embeds the bullet, position, and company", () => {
    const prompt = buildBulletSuggestionsPrompt({
      bullet: "Managed team of designers",
      position: "Design Lead",
      company: "Acme Corp",
    });
    expect(prompt).toContain("Managed team of designers");
    expect(prompt).toContain("Design Lead");
    expect(prompt).toContain("Acme Corp");
  });

  it("includes the jobDescription block when provided", () => {
    const prompt = buildBulletSuggestionsPrompt({
      bullet: "x",
      position: "p",
      company: "c",
      jobDescription: "Senior Designer role",
    });
    expect(prompt).toContain("Offre ciblée");
    expect(prompt).toContain("Senior Designer role");
  });

  it("omits the jobDescription block when missing", () => {
    const prompt = buildBulletSuggestionsPrompt({
      bullet: "x",
      position: "p",
      company: "c",
    });
    expect(prompt).not.toContain("Offre ciblée");
  });

  it("includes missing keywords when provided", () => {
    const prompt = buildBulletSuggestionsPrompt({
      bullet: "x",
      position: "p",
      company: "c",
      missingKeywords: ["Figma", "Design System"],
    });
    expect(prompt).toContain("Figma");
    expect(prompt).toContain("Design System");
  });

  it("contains fabrication guard and JSON-only instruction", () => {
    const prompt = buildBulletSuggestionsPrompt({
      bullet: "x",
      position: "p",
      company: "c",
    });
    expect(prompt).toContain(FABRICATION_GUARD);
    expect(prompt).toContain("Retourne UNIQUEMENT le JSON");
  });
});

describe("buildBulletRewritePrompt", () => {
  const BULLETS = [
    { index: 0, text: "Responsable de la gestion", position: "Manager", company: "Acme" },
    { index: 1, text: "Aide à la création", position: "Designer", company: "Acme" },
  ];

  it("embeds every bullet with its metadata", () => {
    const prompt = buildBulletRewritePrompt({
      bullets: BULLETS,
      jobDescription: "Looking for a designer",
      missingKeywords: [],
    });
    expect(prompt).toContain("[0]");
    expect(prompt).toContain("[1]");
    expect(prompt).toContain("Responsable de la gestion");
    expect(prompt).toContain("Aide à la création");
    expect(prompt).toContain("Manager @ Acme");
  });

  it("includes the job description", () => {
    const prompt = buildBulletRewritePrompt({
      bullets: BULLETS,
      jobDescription: "Senior Designer role for 5 brands",
      missingKeywords: [],
    });
    expect(prompt).toContain("Senior Designer role for 5 brands");
  });

  it("includes missing keywords line when present", () => {
    const prompt = buildBulletRewritePrompt({
      bullets: BULLETS,
      jobDescription: "x",
      missingKeywords: ["Figma", "Sketch"],
    });
    expect(prompt).toContain("Figma, Sketch");
  });

  it("omits missing keywords line when empty", () => {
    const prompt = buildBulletRewritePrompt({
      bullets: BULLETS,
      jobDescription: "x",
      missingKeywords: [],
    });
    expect(prompt).not.toContain("Intègre naturellement ces mots-clés");
  });

  it("contains fabrication guard and JSON-only instruction", () => {
    const prompt = buildBulletRewritePrompt({
      bullets: BULLETS,
      jobDescription: "x",
      missingKeywords: [],
    });
    expect(prompt).toContain(FABRICATION_GUARD);
    expect(prompt).toContain("Retourne UNIQUEMENT le JSON");
  });
});
