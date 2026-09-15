import { describe, it, expect } from "vitest";
import { hasUnbackedNumber, numbersOf } from "../numbers";

describe("numbersOf", () => {
  // A translated or reformatted number is the same fact, never an invention
  it("reads a number whatever its thousands separator, its scale or its words", () => {
    expect(numbersOf("Mené 1 500 entretiens, conducted 1,500 interviews")).toEqual(["1500", "1500"]);
    expect(numbersOf("5k utilisateurs, 30M+ de visites, 30 millions de vues")).toEqual(["5000", "30000000", "30000000"]);
    expect(numbersOf("Ran three workshops, vingt ateliers, seventy clients")).toEqual(["3", "20", "70"]);
  });

  it("reads each word of a compound number, so a changed one is not backed by the others", () => {
    expect(numbersOf("cinq cents clients, quatre-vingts ateliers")).toEqual(["5", "100", "4", "20"]);
  });

  it("reads a multiplier, never a digit inside a name", () => {
    expect(numbersOf("Conversion multipliée par x3, puis ×3, 10x plus vite")).toEqual(["3", "3", "10"]);
    expect(numbersOf("SaaS B2B sur S3, iOS17, a11y, H264, rendu 3D")).toEqual([]);
  });

  // Read as 1 and 9, they removed legitimate bullets
  it("does not read the articles un, une, one nor neuf, pour cent nor the month sept.", () => {
    expect(numbersOf("Conçu un produit neuf, one of the first")).toEqual([]);
    expect(numbersOf("40 pour cent depuis sept. 2019")).toEqual(["40", "2019"]);
  });

  it("reads a figure written against its unit, never a name starting with digits", () => {
    expect(numbersOf("Latence 40ms, réponse sous 48h, livré en 3j, 5h/semaine, 16Go, 15e")).toEqual(["40", "48", "3", "5", "16", "15"]);
    expect(numbersOf("99designs, 360Learning, vidéo 1080p")).toEqual([]);
    expect(numbersOf("10ans, 12mois, 30jours, 100km, 1ère, 2h30")).toEqual(["10", "12", "30", "100", "1", "2"]);
  });

  it("reads « un » in a compound only as a number part, and « sept. » at a sentence end as seven", () => {
    expect(numbersOf("one-hundred clients, deux-en-un, dix-neuf")).toEqual(["100", "2", "10", "9"]);
    expect(numbersOf("Encadré une équipe de sept.")).toEqual(["7"]);
    expect(numbersOf("des dizaines de clients")).toEqual(numbersOf("dozens of clients"));
  });

  it("reads approximate numbers and every part of a compound, never the verb seize nor per cent", () => {
    expect(numbersOf("une dizaine de clients, twenty-one, vingt-et-un")).toEqual(["10", "20", "1", "20", "1"]);
    expect(numbersOf("Seize market share, 20 per cent, de sept. à déc. 2019")).toEqual(["20", "2019"]);
  });

  it("reads through the markdown the templates render", () => {
    expect(numbersOf("**1 2**00 clients")).toEqual(numbersOf("1 200 clients"));
  });
});

describe("hasUnbackedNumber", () => {
  // "1" from a date "2020-01" once backed an invented "1 500"
  it("backs a grouped number by its whole value, or by every one of its parts", () => {
    expect(hasUnbackedNumber("Mené 1 500 entretiens", new Set(["1"]))).toBe(true);
    expect(hasUnbackedNumber("Mené 1 500 entretiens", new Set(["1", "500"]))).toBe(false);
    expect(hasUnbackedNumber("Mené 1 500 entretiens", new Set(["1500"]))).toBe(false);
  });

  it("never backs a scaled figure by its bare number", () => {
    expect(hasUnbackedNumber("30M d'utilisateurs", new Set(["30"]))).toBe(true);
    expect(hasUnbackedNumber("30M d'utilisateurs", new Set(numbersOf("30 millions d'utilisateurs")))).toBe(false);
  });
});
