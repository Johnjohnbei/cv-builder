import { describe, it, expect } from "vitest";
import { buildCoverLetterPrompt } from "../../prompts/coverLetter";

const SAMPLE_CV = {
  personal_info: { name: "Jane Doe" },
  experience: [],
};

const SAMPLE_CV_WITH_TITLE = {
  personal_info: { name: "Jane Doe", title: "Product Manager" },
  experience: [],
};

describe("buildCoverLetterPrompt — persona", () => {
  it("injects the candidate's real title in the French prompt", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV_WITH_TITLE,
      jobDescription: "x",
    });
    expect(prompt).toContain("Tu es Product Manager");
  });

  it("falls back to 'candidat' in French when title is missing", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
    });
    expect(prompt).toContain("Tu es candidat");
  });

  it("injects the candidate's real title in the English prompt", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV_WITH_TITLE,
      jobDescription: "x",
      language: 'en',
    });
    expect(prompt).toContain("You are a Product Manager");
  });

  it("falls back to 'candidate' in English when title is missing", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
      language: 'en',
    });
    expect(prompt).toContain("You are a candidate");
  });

  it("never hardcodes the legacy 'senior designer' persona", () => {
    for (const language of ['fr', 'en'] as const) {
      const prompt = buildCoverLetterPrompt({
        cvData: SAMPLE_CV_WITH_TITLE,
        jobDescription: "x",
        language,
      });
      expect(prompt.toLowerCase()).not.toContain("senior designer");
    }
  });

  it("treats a whitespace-only title as missing", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: { personal_info: { name: "Jane Doe", title: "   " }, experience: [] },
      jobDescription: "x",
    });
    expect(prompt).toContain("Tu es candidat");
  });
});

describe("buildCoverLetterPrompt", () => {
  it("embeds CV and job description", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "Senior Designer role",
    });
    expect(prompt).toContain("Jane Doe");
    expect(prompt).toContain("Senior Designer role");
  });

  it("applies default tone when not provided", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
    });
    expect(prompt).toContain("professionnel et engagé");
  });

  it("uses custom tone when provided", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
      tone: "formel et mesuré",
    });
    expect(prompt).toContain("formel et mesuré");
  });

  it("includes company clause when companyName provided", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
      companyName: "Acme Corp",
    });
    expect(prompt).toContain("pour l'entreprise Acme Corp");
  });

  it("omits company clause when companyName missing", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
    });
    expect(prompt).not.toContain("pour l'entreprise");
  });

  it("mentions all four output fields and JSON-only instruction", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
    });
    expect(prompt).toContain("subject");
    expect(prompt).toContain("greeting");
    expect(prompt).toContain("body");
    expect(prompt).toContain("closing");
    expect(prompt).toContain("Retourne UNIQUEMENT le JSON");
  });

  it("defaults to French prompt when language omitted", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
    });
    expect(prompt).toContain("en français");
    expect(prompt).not.toContain("in English");
  });

  it("produces English prompt when language='en'", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "Senior Designer role",
      language: 'en',
    });
    expect(prompt).toContain("in English");
    expect(prompt).toContain("Return ONLY the JSON");
    expect(prompt).not.toContain("en français");
  });

  it("uses English company clause when language='en' + companyName", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
      companyName: "Acme Corp",
      language: 'en',
    });
    expect(prompt).toContain("for Acme Corp");
    expect(prompt).not.toContain("pour l'entreprise");
  });

  it("uses English default tone when language='en' and tone omitted", () => {
    const prompt = buildCoverLetterPrompt({
      cvData: SAMPLE_CV,
      jobDescription: "x",
      language: 'en',
    });
    expect(prompt).toContain("professional and engaged");
  });
});
