import { describe, it, expect } from "vitest";
import { resolveAdaptLanguage } from "../languageDetection";

const EN_JD = "Warner Bros. Discovery is seeking a transformational executive leader to help shape the next generation of digital entertainment experiences across streaming, connected platforms, audience engagement, and monetization ecosystems throughout Europe. This appointment sits within the senior executive leadership structure and will play a critical role in accelerating platform innovation, modernizing digital product infrastructure, and driving strategic growth initiatives.";
const FR_JD = "Nous recherchons un directeur produit senior pour piloter la transformation numérique de nos plateformes de streaming et d'engagement audience. Ce poste est rattaché à la direction exécutive et jouera un rôle clé dans l'accélération de l'innovation produit, la modernisation de notre infrastructure digitale et la conduite des initiatives stratégiques de croissance à travers nos marchés européens.";

describe("resolveAdaptLanguage", () => {
  it("JD wins over override when JD is long enough (EN JD + FR override → EN)", () => {
    expect(resolveAdaptLanguage(EN_JD, "fr", "fr")).toBe("en");
  });

  it("JD wins over override when JD is long enough (FR JD + EN override → FR)", () => {
    expect(resolveAdaptLanguage(FR_JD, "en", "en")).toBe("fr");
  });

  it("falls back to override when JD is too short", () => {
    expect(resolveAdaptLanguage("short", "en", "fr")).toBe("en");
  });

  it("falls back to detectedLanguage when no JD and no override", () => {
    expect(resolveAdaptLanguage(undefined, undefined, "en")).toBe("en");
  });

  it("defaults to fr when nothing is provided", () => {
    expect(resolveAdaptLanguage(undefined, undefined, undefined)).toBe("fr");
  });
});
